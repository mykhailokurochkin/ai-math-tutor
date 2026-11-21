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

/**
 * Deterministic Pedagogical Finite State Machine transition function.
 * Enforces Socratic hint progression (L1 -> L2 -> L3), Worked Example escape hatch after 3 failed attempts,
 * and mandatory Reinforcement problem generation when a student makes mistakes before solving.
 */
export function computeFSMTransition(
  currentState: FSMState,
  problem: MathProblem,
  classification: InputClassification,
  verification: VerificationResult,
  explicitWorkedExampleRequest = false
): FSMTransitionResult {
  const prevPhase = currentState.phase;
  const prevHint = currentState.hintLevel;

  // 1. Check if student explicitly requested a worked example AND has already attempted at least once
  //    (or if explicitWorkedExampleRequest flag was passed from UI button after attempts)
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
          "Учень запросив покроковий розбір після спроб розв'язання -> перехід у WORKED_EXAMPLE + обов'язкове закріплення (REINFORCEMENT).",
      },
      shouldGenerateReinforcement: true,
    };
  }

  // 2. If student provided a full equation step
  if (verification.hasMathExpression) {
    // 2a. Valid and equivalent equation step
    if (verification.isEquivalentToTarget) {
      // Final root reached (e.g., x = 7)
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
                "Учень виправив помилку і дійшов до правильного кореня -> обов'язкова перевірка розуміння на аналогічній задачі (REINFORCEMENT).",
            },
            shouldGenerateReinforcement: true,
          };
        }

        // Clean mastery! (Either solved without errors, or completed the reinforcement problem!)
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
              ? "Учень успішно розв'язав задачу на закріплення -> тему засвоєно (MASTERED)!"
              : "Учень безпомилково розв'язав рівняння до кінця -> тему засвоєно (MASTERED)!",
          },
          shouldGenerateReinforcement: false,
        };
      }

      // Intermediate valid algebraic step (e.g., 3x + 12 = 2x + 19 or x + 12 = 19)
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
            "Проміжний алгебраїчний крок математично еквівалентний -> скидання лічильника помилок кроку, продовження розв'язання.",
        },
        shouldGenerateReinforcement: false,
      };
    }

    // 2b. Student made an algebraic mistake!
    const nextFailedAttempts = currentState.failedAttemptsOnCurrentStep + 1;
    const detectedCategory: ErrorCategory =
      verification.errorCategory !== "NONE"
        ? verification.errorCategory
        : currentState.activeErrorCategory !== "NONE"
          ? currentState.activeErrorCategory
          : "ARITHMETIC_OR_ALGEBRAIC";

    // Check if student exceeded max Socratic attempts (e.g. > 3 failed attempts on the same step)
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
          reason: `Перевищено ліміт спроб (${MAX_SOCRATIC_ATTEMPTS_BEFORE_WORKED_EXAMPLE}) на одному кроці -> автоматичний перехід у WORKED_EXAMPLE (покроковий розбір + задача на закріплення).`,
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
        reason: `Виявлено алгебраїчну помилку (${detectedCategory}) -> перехід у SOCRATIC_GUIDE (Рівень підказки L${nextHintLevel}).`,
      },
      shouldGenerateReinforcement: false,
    };
  }

  // 3. Student did NOT write a full equation (e.g., GIVE_UP_REQUEST, HINT_REQUEST, SUB_STEP_VALUE, or CONCEPTUAL_REPLY)
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
            "Учень вичерпав усі 3 рівні сократівських підказок -> надання покрокового розбору (WORKED_EXAMPLE) + задача на закріплення.",
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
            ? `Учень просить готову відповідь -> Socratic Guardrail блокує злив, підвищуємо підказку до L${nextHintLevel}.`
            : `Запит підказки -> перехід у SOCRATIC_GUIDE (L${nextHintLevel}).`,
      },
      shouldGenerateReinforcement: false,
    };
  }

  // 4. Conceptual reply or sub-step value (e.g. answering "12" to "What is 3 * 4?")
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
        "Проміжна репліка або відповідь на навідне питання -> продовження сократівського діалогу.",
    },
    shouldGenerateReinforcement: false,
  };
}
