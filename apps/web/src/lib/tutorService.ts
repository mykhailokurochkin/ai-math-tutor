import {
  createInitialFSMState,
  lookupCurriculumRule,
  runTutorHarnessTurn,
} from "@ai-math-tutor/tutor-harness";
import {
  getOrInitProfileState,
  saveDatabase,
  type ChatMessageRecord,
  type MistakeLogRecord,
  type NotebookStepRecord,
} from "./store";

export async function processStudentStepInStore(params: {
  profileId: string;
  studentMessage: string;
  requestWorkedExample?: boolean;
}) {
  const { profileId, studentMessage, requestWorkedExample } = params;
  const state = getOrInitProfileState(profileId);
  const { db, profile, session } = state;
  const activeProblem = session.currentProblem;

  const conversationHistory = session.chatMessages
    .filter((m): m is ChatMessageRecord & { role: "student" | "tutor" } =>
      m.role === "student" || m.role === "tutor"
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const turn = await runTutorHarnessTurn({
    problem: activeProblem,
    fsmState: session.fsmState,
    studentMessage,
    requestWorkedExample,
    conversationHistory,
  });

  const now = new Date().toISOString();

  // 1. Append student chat message
  session.chatMessages.push({
    id: `msg-stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "student",
    content: studentMessage,
    timestamp: now,
  });

  // 2. Append notebook step if math expression was submitted or worked example given
  if (
    turn.verification.hasMathExpression ||
    turn.stepStatus === "WORKED_EXAMPLE_GIVEN"
  ) {
    const stepStatus: NotebookStepRecord["status"] =
      turn.stepStatus === "WORKED_EXAMPLE_GIVEN"
        ? "WORKED_EXAMPLE"
        : turn.stepStatus === "CORRECT_FINAL"
          ? "CORRECT_FINAL"
          : turn.stepStatus === "CORRECT_INTERMEDIATE"
            ? "CORRECT_INTERMEDIATE"
            : "ERROR_DETECTED";

    const exprLatex =
      turn.stepStatus === "WORKED_EXAMPLE_GIVEN"
        ? turn.verification.expectedNextCanonicalStep ?? activeProblem.equation
        : turn.verification.extractedEquation ?? studentMessage;

    session.notebookSteps.push({
      id: `step-${Date.now()}-${session.notebookSteps.length + 1}`,
      stepNumber: session.notebookSteps.length + 1,
      problemId: activeProblem.id,
      problemEquation: activeProblem.equation,
      rawInput: studentMessage,
      expressionLatex: exprLatex,
      status: stepStatus,
      errorCategory: turn.verification.errorCategory,
      diagnosticNote: turn.verification.diagnosticSummary,
      timestamp: now,
    });
  }

  // 3. Update Mistakes & Skill Mastery
  const profileMistakes = db.mistakes[profile.id] ?? [];
  const profileSkills = db.skillMastery[profile.id] ?? [];

  if (turn.stepStatus === "ERROR_DETECTED") {
    const errCat = turn.verification.errorCategory;
    const rule = lookupCurriculumRule(errCat);
    const newMistake: MistakeLogRecord = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileId: profile.id,
      problemId: activeProblem.id,
      problemEquation: activeProblem.equation,
      studentWrongStep:
        turn.verification.extractedEquation ?? studentMessage.trim(),
      errorCategory: errCat,
      ruleTitle: rule?.titleUk ?? "Алгебраїчне перетворення",
      diagnosticSummary: turn.verification.diagnosticSummary,
      status: "OPEN",
      timestamp: now,
    };
    profileMistakes.unshift(newMistake);

    const skill = profileSkills.find((s) => s.errorCategory === errCat);
    if (skill) {
      skill.mistakesCount += 1;
      skill.masteryPercent = Math.max(25, skill.masteryPercent - 6);
    }
  } else if (
    turn.stepStatus === "CORRECT_INTERMEDIATE" ||
    turn.stepStatus === "CORRECT_FINAL"
  ) {
    // Mark any OPEN mistakes on this problem as CORRECTED
    for (const m of profileMistakes) {
      if (m.problemId === activeProblem.id && m.status === "OPEN") {
        m.status = "CORRECTED";
      }
    }
  }

  // 4. Handle Mastery completion
  if (turn.nextFsmState.phase === "MASTERED") {
    if (!session.completedProblemIds.includes(activeProblem.id)) {
      session.completedProblemIds.push(activeProblem.id);
    }

    const skill = profileSkills.find(
      (s) => s.errorCategory === activeProblem.targetSkill
    );
    if (activeProblem.isReinforcement) {
      // Upgrade corrected mistakes for this category to VERIFIED_BY_FOLLOWUP
      for (const m of profileMistakes) {
        if (
          (m.errorCategory === activeProblem.targetSkill ||
            m.problemId === activeProblem.parentProblemId) &&
          m.status !== "VERIFIED_BY_FOLLOWUP"
        ) {
          m.status = "VERIFIED_BY_FOLLOWUP";
        }
      }
      if (skill) {
        skill.solvedCount += 1;
        skill.verifiedFollowUpsCount += 1;
        skill.masteryPercent = Math.min(100, skill.masteryPercent + 16);
      }
    } else if (skill) {
      skill.solvedCount += 1;
      skill.masteryPercent = Math.min(100, skill.masteryPercent + 10);
    }
  }

  // 5. Append Tutor chat response & Harness Trace
  session.chatMessages.push({
    id: `msg-tut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "tutor",
    content: turn.tutorMessage,
    timestamp: now,
    phaseBadge: turn.nextFsmState.phase,
    hintLevel: turn.nextFsmState.hintLevel,
    errorTag:
      turn.verification.errorCategory !== "NONE"
        ? turn.verification.errorCategory
        : undefined,
  });

  session.traces.unshift(turn.trace);

  // 6. If a follow-up REINFORCEMENT problem was generated, transition active problem to it seamlessly
  if (turn.followUpProblem) {
    if (turn.nextFsmState.wasAssisted) {
      if (!session.assistedProblemIds.includes(activeProblem.id)) {
        session.assistedProblemIds.push(activeProblem.id);
      }
    } else if (!session.completedProblemIds.includes(activeProblem.id)) {
      session.completedProblemIds.push(activeProblem.id);
    }

    const customList = db.customProblems[profile.id] ?? [];
    customList.push(turn.followUpProblem);
    db.customProblems[profile.id] = customList;

    session.currentProblem = turn.followUpProblem;
    session.fsmState = createInitialFSMState(turn.followUpProblem);
  } else {
    session.fsmState = turn.nextFsmState;
  }

  saveDatabase(db);

  return {
    turn,
    state: getOrInitProfileState(profile.id),
  };
}
