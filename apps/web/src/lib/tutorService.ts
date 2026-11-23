import {
  createInitialFSMState,
  lookupCurriculumRule,
  runTutorHarnessTurn,
} from "@ai-math-tutor/tutor-harness";
import {
  createInitialChatForProblem,
  getOrInitProfileState,
  saveDatabase,
  syncActiveSessionToWorkspaceHistory,
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

  session.chatMessages.push({
    id: `msg-stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "student",
    content: studentMessage,
    timestamp: now,
  });

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
      ruleTitle: rule?.titleEn ?? "Algebraic Manipulation",
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
    for (const m of profileMistakes) {
      if (m.problemId === activeProblem.id && m.status === "OPEN") {
        m.status = "CORRECTED";
      }
    }
  }

  if (turn.nextFsmState.phase === "MASTERED") {
    if (!session.completedProblemIds.includes(activeProblem.id)) {
      session.completedProblemIds.push(activeProblem.id);
    }

    const skill = profileSkills.find(
      (s) => s.errorCategory === activeProblem.targetSkill
    );
    if (activeProblem.isReinforcement) {
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

  if (turn.followUpProblem) {
    if (turn.nextFsmState.wasAssisted) {
      if (!session.assistedProblemIds.includes(activeProblem.id)) {
        session.assistedProblemIds.push(activeProblem.id);
      }
    } else if (!session.completedProblemIds.includes(activeProblem.id)) {
      session.completedProblemIds.push(activeProblem.id);
    }

    // Save the finished problem's full history before switching to the follow-up problem!
    session.fsmState = turn.nextFsmState;
    syncActiveSessionToWorkspaceHistory(db, profile.id);

    const customList = db.customProblems[profile.id] ?? [];
    customList.push(turn.followUpProblem);
    db.customProblems[profile.id] = customList;

    const nextFsm = createInitialFSMState(turn.followUpProblem);
    session.currentProblem = turn.followUpProblem;
    session.fsmState = nextFsm;
    session.notebookSteps = [];
    // Keep the tutor's message announcing the follow-up problem at the start of the follow-up chat
    session.chatMessages = [
      {
        id: `msg-followup-${Date.now()}`,
        role: "tutor",
        content: turn.tutorMessage,
        timestamp: now,
        phaseBadge: nextFsm.phase,
        hintLevel: 0,
      },
    ];
    syncActiveSessionToWorkspaceHistory(db, profile.id);
  } else {
    session.fsmState = turn.nextFsmState;
    syncActiveSessionToWorkspaceHistory(db, profile.id);
  }

  saveDatabase(db);

  return {
    turn,
    state: getOrInitProfileState(profile.id),
  };
}
