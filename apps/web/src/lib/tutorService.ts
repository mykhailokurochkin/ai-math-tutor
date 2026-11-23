import {
  createInitialFSMState,
  lookupCurriculumRule,
  runTutorHarnessTurn,
} from "@ai-math-tutor/tutor-harness";
import {
  createInitialChatForProblem,
  getOrInitProfileState,
  recomputeProfileSkillMastery,
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

  // If the previous problem generated a follow-up problem and the student now sends their next step,
  // seamlessly activate the pending follow-up problem first!
  if (session.pendingFollowUpProblem) {
    const followUp = session.pendingFollowUpProblem;
    const nextFsm = createInitialFSMState(followUp);
    session.currentProblem = followUp;
    session.pendingFollowUpProblem = null;
    session.fsmState = nextFsm;
    session.notebookSteps = [];
    session.chatMessages = createInitialChatForProblem(
      profile.id,
      followUp,
      nextFsm
    );
    syncActiveSessionToWorkspaceHistory(db, profile.id);
  }

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

    const prevEq = session.fsmState.lastValidEquation || activeProblem.equation;
    const prevHadBrackets = /[()]/.test(prevEq);
    const currHasBrackets = /[()]/.test(exprLatex);

    let operationSummary = turn.verification.diagnosticSummary;
    if (stepStatus === "CORRECT_FINAL") {
      operationSummary = `Isolated variable ${activeProblem.variable} and found the verified solution ${activeProblem.variable} = ${activeProblem.expectedRoot}.`;
    } else if (stepStatus === "CORRECT_INTERMEDIATE") {
      if (prevHadBrackets && !currHasBrackets) {
        operationSummary = `Expanded parentheses via Distributive Property (${turn.verification.lhsStudent?.formatted ?? ""} = ${turn.verification.rhsStudent?.formatted ?? ""}). Algebraic equivalence preserved.`;
      } else {
        operationSummary = `Transposed and simplified terms (${turn.verification.lhsStudent?.formatted ?? ""} = ${turn.verification.rhsStudent?.formatted ?? ""}) while preserving root ${activeProblem.variable} = ${activeProblem.expectedRoot}.`;
      }
    } else if (stepStatus === "WORKED_EXAMPLE") {
      operationSummary = `Tutor provided a worked breakdown leading to $${exprLatex}$.`;
    }

    // Concise first paragraph / sentence of tutor commentary for this step
    const tutorExcerpt =
      turn.tutorMessage.split(/\n\n+/)[0]?.trim() ?? turn.tutorMessage;

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
      operationSummary,
      tutorComment: tutorExcerpt,
      timestamp: now,
    });
  }

  const profileMistakes = db.mistakes[profile.id] ?? [];

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

    // Keep the solved problem and its final step visible on the board,
    // and attach the generated follow-up problem so the user sees the transition clearly!
    session.fsmState = turn.nextFsmState;
    session.pendingFollowUpProblem = turn.followUpProblem;
    syncActiveSessionToWorkspaceHistory(db, profile.id);

    const customList = db.customProblems[profile.id] ?? [];
    customList.push(turn.followUpProblem);
    db.customProblems[profile.id] = customList;
  } else {
    session.fsmState = turn.nextFsmState;
    syncActiveSessionToWorkspaceHistory(db, profile.id);
  }

  recomputeProfileSkillMastery(db, profile.id);
  saveDatabase(db);

  return {
    turn,
    state: getOrInitProfileState(profile.id),
  };
}
