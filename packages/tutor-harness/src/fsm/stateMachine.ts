import type {
  ErrorCategory,
  FSMState,
  FSMTransitionTrace,
  HintLevel,
  InputClassification,
  MathProblem,
  VerificationResult,
} from "../types";

export const MAX_SOCRATIC_ATTEMPTS_BEFORE_WORKED_EXAMPLE = 3;

export function createInitialFSMState(problem: MathProblem): FSMState {
  return {
    phase: problem.isReinforcement ? "REINFORCEMENT" : "SOLVING",
    hintLevel: 0,
    failedAttemptsOnCurrentStep: 0,
    totalMistakesInProblem: 0,
    hadMistakeInProblem: false,
    wasAssisted: false,
    lastValidEquation: problem.equation,
    activeErrorCategory: "NONE",
  };
}

export interface FSMTransitionResult {
  nextState: FSMState;
  trace: FSMTransitionTrace;
  shouldGenerateReinforcement: boolean;
}

export function computeFSMTransition(
  currentState: FSMState,
  problem: MathProblem,
  classification: InputClassification,
  verification: VerificationResult,
  explicitWorkedExampleRequest = false
): FSMTransitionResult {
  const prevPhase = currentState.phase;
  const prevHint = currentState.hintLevel;

  const canUnlockWorkedExample =
    currentState.failedAttemptsOnCurrentStep >= 1 &&
    (explicitWorkedExampleRequest || classification === "WORKED_EXAMPLE_REQUEST");

  if (canUnlockWorkedExample) {
    const nextState: FSMState = {
      ...currentState,
      phase: "WORKED_EXAMPLE",
      hintLevel: 3,
      wasAssisted: true,
      hadMistakeInProblem: true,
    };
    return {
      nextState,
      trace: {
        from: prevPhase,
        to: "WORKED_EXAMPLE",
        prevHintLevel: prevHint,
        nextHintLevel: 3,
        failedAttemptsOnStep: currentState.failedAttemptsOnCurrentStep,
        reason:
          "Student requested worked explanation after attempting -> transition to WORKED_EXAMPLE + generate follow-up practice (REINFORCEMENT).",
      },
      shouldGenerateReinforcement: true,
    };
  }

  if (verification.hasMathExpression) {
    if (verification.isEquivalentToTarget) {
      if (verification.isFinalSolvedStep) {
        const needsReinforcement =
          (currentState.hadMistakeInProblem || currentState.wasAssisted) &&
          !problem.isReinforcement;

        if (needsReinforcement) {
          const nextState: FSMState = {
            ...currentState,
            phase: "REINFORCEMENT",
            hintLevel: 0,
            failedAttemptsOnCurrentStep: 0,
            lastValidEquation:
              verification.extractedEquation ?? currentState.lastValidEquation,
          };
          return {
            nextState,
            trace: {
              from: prevPhase,
              to: "REINFORCEMENT",
              prevHintLevel: prevHint,
              nextHintLevel: 0,
              failedAttemptsOnStep: 0,
              reason:
                "Student corrected their earlier error and solved the equation -> generating a similar follow-up problem to verify understanding (REINFORCEMENT).",
            },
            shouldGenerateReinforcement: true,
          };
        }

        const nextState: FSMState = {
          ...currentState,
          phase: "MASTERED",
          hintLevel: 0,
          failedAttemptsOnCurrentStep: 0,
          lastValidEquation:
            verification.extractedEquation ?? currentState.lastValidEquation,
        };
        return {
          nextState,
          trace: {
            from: prevPhase,
            to: "MASTERED",
            prevHintLevel: prevHint,
            nextHintLevel: 0,
            failedAttemptsOnStep: 0,
            reason: problem.isReinforcement
              ? "Student independently solved the follow-up practice problem -> concept verified & MASTERED!"
              : "Student solved the problem cleanly without errors -> concept MASTERED!",
          },
          shouldGenerateReinforcement: false,
        };
      }

      const nextPhase = problem.isReinforcement ? "REINFORCEMENT" : "SOLVING";
      const nextState: FSMState = {
        ...currentState,
        phase: nextPhase,
        hintLevel: 0,
        failedAttemptsOnCurrentStep: 0,
        lastValidEquation:
          verification.extractedEquation ?? currentState.lastValidEquation,
        activeErrorCategory: "NONE",
      };
      return {
        nextState,
        trace: {
          from: prevPhase,
          to: nextPhase,
          prevHintLevel: prevHint,
          nextHintLevel: 0,
          failedAttemptsOnStep: 0,
          reason:
            "Intermediate algebraic step is mathematically equivalent -> reset step error counter and continue solving.",
        },
        shouldGenerateReinforcement: false,
      };
    }

    const nextFailedAttempts = currentState.failedAttemptsOnCurrentStep + 1;
    const detectedCategory: ErrorCategory =
      verification.errorCategory !== "NONE"
        ? verification.errorCategory
        : currentState.activeErrorCategory !== "NONE"
          ? currentState.activeErrorCategory
          : "ARITHMETIC_OR_ALGEBRAIC";

    if (nextFailedAttempts > MAX_SOCRATIC_ATTEMPTS_BEFORE_WORKED_EXAMPLE) {
      const nextState: FSMState = {
        ...currentState,
        phase: "WORKED_EXAMPLE",
        hintLevel: 3,
        failedAttemptsOnCurrentStep: nextFailedAttempts,
        totalMistakesInProblem: currentState.totalMistakesInProblem + 1,
        hadMistakeInProblem: true,
        wasAssisted: true,
        activeErrorCategory: detectedCategory,
      };
      return {
        nextState,
        trace: {
          from: prevPhase,
          to: "WORKED_EXAMPLE",
          prevHintLevel: prevHint,
          nextHintLevel: 3,
          failedAttemptsOnStep: nextFailedAttempts,
          reason: `Exceeded max Socratic attempts (${MAX_SOCRATIC_ATTEMPTS_BEFORE_WORKED_EXAMPLE}) on the same step -> automatic transition to WORKED_EXAMPLE + follow-up practice.`,
        },
        shouldGenerateReinforcement: true,
      };
    }

    const nextHintLevel = Math.min(3, nextFailedAttempts) as HintLevel;
    const nextState: FSMState = {
      ...currentState,
      phase: "SOCRATIC_GUIDE",
      hintLevel: nextHintLevel,
      failedAttemptsOnCurrentStep: nextFailedAttempts,
      totalMistakesInProblem: currentState.totalMistakesInProblem + 1,
      hadMistakeInProblem: true,
      activeErrorCategory: detectedCategory,
    };

    return {
      nextState,
      trace: {
        from: prevPhase,
        to: "SOCRATIC_GUIDE",
        prevHintLevel: prevHint,
        nextHintLevel,
        failedAttemptsOnStep: nextFailedAttempts,
        reason: `Detected algebraic reasoning error (${detectedCategory}) -> transition to SOCRATIC_GUIDE (Hint Level L${nextHintLevel}).`,
      },
      shouldGenerateReinforcement: false,
    };
  }

  if (
    classification === "GIVE_UP_REQUEST" ||
    classification === "HINT_REQUEST" ||
    classification === "WORKED_EXAMPLE_REQUEST"
  ) {
    const nextFailedAttempts = currentState.failedAttemptsOnCurrentStep + 1;
    if (nextFailedAttempts > MAX_SOCRATIC_ATTEMPTS_BEFORE_WORKED_EXAMPLE) {
      const nextState: FSMState = {
        ...currentState,
        phase: "WORKED_EXAMPLE",
        hintLevel: 3,
        failedAttemptsOnCurrentStep: nextFailedAttempts,
        hadMistakeInProblem: true,
        wasAssisted: true,
      };
      return {
        nextState,
        trace: {
          from: prevPhase,
          to: "WORKED_EXAMPLE",
          prevHintLevel: prevHint,
          nextHintLevel: 3,
          failedAttemptsOnStep: nextFailedAttempts,
          reason:
            "Student exhausted all 3 Socratic hint levels -> providing step-by-step worked example + follow-up practice.",
        },
        shouldGenerateReinforcement: true,
      };
    }

    const nextHintLevel = Math.min(
      3,
      Math.max(1, currentState.hintLevel + 1)
    ) as HintLevel;
    const nextState: FSMState = {
      ...currentState,
      phase: "SOCRATIC_GUIDE",
      hintLevel: nextHintLevel,
      failedAttemptsOnCurrentStep: nextFailedAttempts,
      hadMistakeInProblem: true,
    };

    return {
      nextState,
      trace: {
        from: prevPhase,
        to: "SOCRATIC_GUIDE",
        prevHintLevel: prevHint,
        nextHintLevel,
        failedAttemptsOnStep: nextFailedAttempts,
        reason:
          classification === "GIVE_UP_REQUEST"
            ? `Student asked for direct answer -> Socratic Guardrail blocked answer leak, escalating hint to L${nextHintLevel}.`
            : `Hint requested -> transition to SOCRATIC_GUIDE (L${nextHintLevel}).`,
      },
      shouldGenerateReinforcement: false,
    };
  }

  const keepHint = (currentState.hintLevel || 1) as HintLevel;
  const nextState: FSMState = {
    ...currentState,
    phase:
      currentState.phase === "SOCRATIC_GUIDE"
        ? "SOCRATIC_GUIDE"
        : currentState.phase,
    hintLevel: keepHint,
  };

  return {
    nextState,
    trace: {
      from: prevPhase,
      to: nextState.phase,
      prevHintLevel: prevHint,
      nextHintLevel: keepHint,
      failedAttemptsOnStep: currentState.failedAttemptsOnCurrentStep,
      reason:
        "Intermediate reply or answer to Socratic question -> continuing guided dialogue.",
    },
    shouldGenerateReinforcement: false,
  };
}
