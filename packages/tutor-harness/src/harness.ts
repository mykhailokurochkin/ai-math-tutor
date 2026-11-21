import type {
  HarnessTrace,
  MathProblem,
  PedagogicalPhase,
  TutorTurnInput,
  TutorTurnOutput,
} from "./types";
import { lookupCurriculumRule } from "./config/pedagogyConfig";
import { normalizeStudentInput } from "./math/normalizer";
import { verifyStudentStep } from "./math/verifier";
import { generateIsomorphicProblem } from "./math/generator";
import { computeFSMTransition } from "./fsm/stateMachine";
import {
  enforceLeakageGate,
  getForbiddenReveals,
} from "./guardrails/leakageGate";
import { generateTutorResponse } from "./llm/provider";

function buildPedagogicalDirective(
  phase: PedagogicalPhase,
  hintLevel: number,
  followUpProblem?: MathProblem
): string {
  switch (phase) {
    case "SOCRATIC_GUIDE":
      if (hintLevel === 1) {
        return "Guide the student with a Level 1 conceptual question pointing to the mathematical property violated. Do NOT reveal the corrected step or final root. End with one question.";
      }
      if (hintLevel === 2) {
        return "Guide the student with a Level 2 focused hint pointing directly to the term/number they missed or miscalculated. Do NOT give the final root. End with one question.";
      }
      return "Guide the student with a Level 3 concrete micro-step prompt so they can write the corrected equation. Do NOT give the final root. End with one question.";
    case "WORKED_EXAMPLE":
      return `The student struggled for 3 attempts. Provide a clear, supportive step-by-step worked explanation of the stuck step and present the new follow-up reinforcement problem: ${followUpProblem?.equation ?? ""}.`;
    case "REINFORCEMENT":
      return followUpProblem
        ? `Congratulate the student on fixing their error and finding the root, then immediately present the new isomorphic problem (${followUpProblem.equation}) to verify independent mastery.`
        : "Confirm the student's progress on the reinforcement problem and ask for their next step.";
    case "MASTERED":
      return "Congratulate the student on mastering the problem and verify their final root.";
    default:
      return "Confirm the student's valid intermediate algebraic step and ask what operation they will perform next.";
  }
}

/**
 * Core Neuro-Symbolic Pedagogical Harness Execution Loop.
 * Orchestrates:
 * 1. Hybrid Input Normalization (extracting math from natural dialogue)
 * 2. Symbolic CAS Math Verification (CortexJS + Linear Polynomial Diff)
 * 3. Pedagogical Finite State Machine Transition (SOLVING -> SOCRATIC_GUIDE L1..L3 -> WORKED_EXAMPLE -> REINFORCEMENT -> MASTERED)
 * 4. Isomorphic Problem Generation (with CAS root verification)
 * 5. Curriculum Rule Lookup (USSR Kiselev/Makarychev methodology)
 * 6. LLM Generation + Output-Admission Guardrail (LeakageGate)
 */
export async function runTutorHarnessTurn(
  input: TutorTurnInput
): Promise<TutorTurnOutput> {
  const startMs = Date.now();
  const { problem, fsmState, studentMessage, requestWorkedExample } = input;

  // Step 1: Normalize raw student input and classify intent
  const normalized = normalizeStudentInput(studentMessage, problem.variable);

  // Step 2: Run deterministic Symbolic Math Verifier against last valid equation
  const verification = verifyStudentStep(
    studentMessage,
    fsmState.lastValidEquation || problem.equation,
    problem.expectedRoot,
    problem.variable
  );

  // Step 3: Transition Pedagogical Finite State Machine
  const fsmResult = computeFSMTransition(
    fsmState,
    problem,
    normalized.classification,
    verification,
    Boolean(requestWorkedExample)
  );
  const { nextState, trace: fsmTrace, shouldGenerateReinforcement } = fsmResult;

  // Step 4: Generate CAS-verified isomorphic follow-up problem if transitioning to REINFORCEMENT or WORKED_EXAMPLE
  let followUpProblem: MathProblem | undefined;
  if (shouldGenerateReinforcement) {
    followUpProblem = generateIsomorphicProblem(
      problem,
      nextState.activeErrorCategory,
      nextState.totalMistakesInProblem
    );
  }

  // Step 5: Lookup USSR Curriculum Rule for the active error category
  const activeCategory =
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : nextState.activeErrorCategory;
  const curriculumRule = lookupCurriculumRule(activeCategory);

  // Step 6: Build Hidden Symbolic Scratchpad & Forbidden Reveals
  const forbiddenReveals = getForbiddenReveals(
    problem,
    verification,
    nextState.phase,
    nextState.hintLevel
  );
  const pedagogicalDirective = buildPedagogicalDirective(
    nextState.phase,
    nextState.hintLevel,
    followUpProblem
  );

  // Step 7: Generate candidate response via LLM (or Neuro-Symbolic Guided Synthesizer)
  const llmResult = await generateTutorResponse({
    problem,
    studentMessage,
    classification: normalized.classification,
    verification,
    nextFsmState: nextState,
    curriculumRule,
    forbiddenReveals,
    pedagogicalDirective,
    followUpProblem,
    conversationHistory: input.conversationHistory,
  });

  // Step 8: Run Output-Admission Control (LeakageGate)
  const guardrailResult = enforceLeakageGate(
    llmResult.text,
    problem,
    verification,
    nextState.phase,
    nextState.hintLevel,
    activeCategory
  );

  // Determine high-level step status for UI highlighting
  let stepStatus: TutorTurnOutput["stepStatus"] = "GUIDANCE_TURN";
  if (nextState.phase === "WORKED_EXAMPLE") {
    stepStatus = "WORKED_EXAMPLE_GIVEN";
  } else if (verification.hasMathExpression) {
    if (verification.isFinalSolvedStep) {
      stepStatus = "CORRECT_FINAL";
    } else if (verification.isEquivalentToTarget) {
      stepStatus = "CORRECT_INTERMEDIATE";
    } else {
      stepStatus = "ERROR_DETECTED";
    }
  }

  const latencyMs = Math.max(1, Date.now() - startMs);

  const trace: HarnessTrace = {
    timestamp: new Date().toISOString(),
    inputRaw: studentMessage,
    inputClassification: normalized.classification,
    verification,
    fsmTransition: fsmTrace,
    curriculumLookup: curriculumRule
      ? {
          ruleId: curriculumRule.id,
          ruleTitle: curriculumRule.titleUk,
          formulaLatex: curriculumRule.formulaLatex,
          ussrMethodologyNote: curriculumRule.ussrMethodologyNote,
        }
      : null,
    hiddenScratchpad: {
      forbiddenReveals,
      pedagogicalDirective,
    },
    guardrailCheck: guardrailResult.trace,
    generatedFollowUpProblem: followUpProblem,
    llmProvider: llmResult.providerLabel,
    latencyMs,
  };

  return {
    tutorMessage: guardrailResult.safeResponse,
    nextFsmState: nextState,
    verification,
    trace,
    followUpProblem,
    stepStatus,
  };
}
