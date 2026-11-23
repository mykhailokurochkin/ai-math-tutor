import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type {
  CurriculumRule,
  ErrorCategory,
  FSMState,
  FSMTransitionTrace,
  GuardrailCheckTrace,
  HarnessTrace,
  MathProblem,
  PedagogicalPhase,
  TutorTurnInput,
  TutorTurnOutput,
  VerificationResult,
} from "./types";
import { lookupCurriculumRule } from "./config/pedagogyConfig";
import {
  normalizeStudentInput,
  type NormalizedStudentInput,
} from "./math/normalizer";
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
 * LangGraph State Annotation defining the typed state channels flowing through
 * the Neuro-Symbolic Pedagogical Graph.
 */
export const TutorGraphState = Annotation.Root({
  input: Annotation<TutorTurnInput>(),
  startMs: Annotation<number>(),
  executedNodes: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  normalized: Annotation<NormalizedStudentInput | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  verification: Annotation<VerificationResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  nextFsmState: Annotation<FSMState | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  fsmTrace: Annotation<FSMTransitionTrace | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  shouldGenerateReinforcement: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  followUpProblem: Annotation<MathProblem | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  activeCategory: Annotation<ErrorCategory>({
    reducer: (_, next) => next,
    default: () => "NONE",
  }),
  curriculumRule: Annotation<CurriculumRule | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  forbiddenReveals: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  pedagogicalDirective: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  candidateResponse: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  providerLabel: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  safeResponse: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  guardrailTrace: Annotation<GuardrailCheckTrace | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  output: Annotation<TutorTurnOutput | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

type TutorGraphStateType = typeof TutorGraphState.State;

// Node 1: Hybrid Input Normalizer
async function normalizeInputNode(state: TutorGraphStateType) {
  const { problem, studentMessage } = state.input;
  const normalized = normalizeStudentInput(studentMessage, problem.variable);
  return {
    normalized,
    executedNodes: ["normalize_input"],
  };
}

// Node 2: Symbolic CAS Math Verifier (@cortex-js/compute-engine)
async function symbolicCasVerifyNode(state: TutorGraphStateType) {
  const { problem, fsmState, studentMessage } = state.input;
  const verification = verifyStudentStep(
    studentMessage,
    fsmState.lastValidEquation || problem.equation,
    problem.expectedRoot,
    problem.variable
  );
  return {
    verification,
    executedNodes: ["symbolic_cas_verify"],
  };
}

// Node 3: Pedagogical Finite State Machine
async function pedagogicalFsmNode(state: TutorGraphStateType) {
  const { problem, fsmState, requestWorkedExample } = state.input;
  const normalized = state.normalized!;
  const verification = state.verification!;

  const fsmResult = computeFSMTransition(
    fsmState,
    problem,
    normalized.classification,
    verification,
    Boolean(requestWorkedExample)
  );

  return {
    nextFsmState: fsmResult.nextState,
    fsmTrace: fsmResult.trace,
    shouldGenerateReinforcement: fsmResult.shouldGenerateReinforcement,
    executedNodes: ["pedagogical_fsm"],
  };
}

// Conditional Router after Pedagogical FSM
function routeAfterFsm(
  state: TutorGraphStateType
): "generate_followup_problem" | "prepare_pedagogical_context" {
  return state.shouldGenerateReinforcement
    ? "generate_followup_problem"
    : "prepare_pedagogical_context";
}

// Node 4 (Conditional): Isomorphic Follow-Up Problem Generator with CAS Root Check
async function generateFollowUpProblemNode(state: TutorGraphStateType) {
  const { problem } = state.input;
  const nextState = state.nextFsmState!;
  const followUpProblem = generateIsomorphicProblem(
    problem,
    nextState.activeErrorCategory,
    nextState.totalMistakesInProblem
  );
  return {
    followUpProblem,
    executedNodes: ["generate_followup_problem"],
  };
}

// Node 5: Curriculum Rule Lookup & Hidden Symbolic Scratchpad Builder
async function preparePedagogicalContextNode(state: TutorGraphStateType) {
  const { problem } = state.input;
  const verification = state.verification!;
  const nextState = state.nextFsmState!;

  const activeCategory: ErrorCategory =
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : nextState.activeErrorCategory;

  const curriculumRule = lookupCurriculumRule(activeCategory);
  const forbiddenReveals = getForbiddenReveals(
    problem,
    verification,
    nextState.phase,
    nextState.hintLevel
  );
  const pedagogicalDirective = buildPedagogicalDirective(
    nextState.phase,
    nextState.hintLevel,
    state.followUpProblem
  );

  return {
    activeCategory,
    curriculumRule,
    forbiddenReveals,
    pedagogicalDirective,
    executedNodes: ["prepare_pedagogical_context"],
  };
}

// Node 6: LLM Socratic Response Generator
async function llmSocraticTutorNode(state: TutorGraphStateType) {
  const { problem, studentMessage, conversationHistory } = state.input;
  const llmResult = await generateTutorResponse({
    problem,
    studentMessage,
    classification: state.normalized!.classification,
    verification: state.verification!,
    nextFsmState: state.nextFsmState!,
    curriculumRule: state.curriculumRule,
    forbiddenReveals: state.forbiddenReveals,
    pedagogicalDirective: state.pedagogicalDirective,
    followUpProblem: state.followUpProblem,
    conversationHistory,
  });

  return {
    candidateResponse: llmResult.text,
    providerLabel: llmResult.providerLabel,
    executedNodes: ["llm_socratic_tutor"],
  };
}

// Node 7: SocraGate Output-Admission Guardrail & Telemetry Assembly
async function socragateGuardrailNode(state: TutorGraphStateType) {
  const { problem, studentMessage } = state.input;
  const verification = state.verification!;
  const nextState = state.nextFsmState!;

  const guardrailResult = enforceLeakageGate(
    state.candidateResponse,
    problem,
    verification,
    nextState.phase,
    nextState.hintLevel,
    state.activeCategory
  );

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

  const finalNodes = [...state.executedNodes, "socragate_guardrail"];
  const latencyMs = Math.max(1, Date.now() - state.startMs);

  const trace: HarnessTrace = {
    timestamp: new Date().toISOString(),
    orchestrator: "LangGraph StateGraph (@langchain/langgraph)",
    langGraphNodesExecuted: finalNodes,
    inputRaw: studentMessage,
    inputClassification: state.normalized!.classification,
    verification,
    fsmTransition: state.fsmTrace!,
    curriculumLookup: state.curriculumRule
      ? {
          ruleId: state.curriculumRule.id,
          ruleTitle: state.curriculumRule.titleEn,
          formulaLatex: state.curriculumRule.formulaLatex,
          ussrMethodologyNote: state.curriculumRule.ussrMethodologyNote,
        }
      : null,
    hiddenScratchpad: {
      forbiddenReveals: state.forbiddenReveals,
      pedagogicalDirective: state.pedagogicalDirective,
    },
    guardrailCheck: guardrailResult.trace,
    generatedFollowUpProblem: state.followUpProblem,
    llmProvider: state.providerLabel,
    latencyMs,
  };

  const output: TutorTurnOutput = {
    tutorMessage: guardrailResult.safeResponse,
    nextFsmState: nextState,
    verification,
    trace,
    followUpProblem: state.followUpProblem,
    stepStatus,
  };

  return {
    safeResponse: guardrailResult.safeResponse,
    guardrailTrace: guardrailResult.trace,
    output,
    executedNodes: ["socragate_guardrail"],
  };
}

/**
 * Builds and compiles the LangGraph StateGraph for the Neuro-Symbolic Math Tutor.
 */
export function createTutorLangGraph() {
  const workflow = new StateGraph(TutorGraphState)
    .addNode("normalize_input", normalizeInputNode)
    .addNode("symbolic_cas_verify", symbolicCasVerifyNode)
    .addNode("pedagogical_fsm", pedagogicalFsmNode)
    .addNode("generate_followup_problem", generateFollowUpProblemNode)
    .addNode("prepare_pedagogical_context", preparePedagogicalContextNode)
    .addNode("llm_socratic_tutor", llmSocraticTutorNode)
    .addNode("socragate_guardrail", socragateGuardrailNode)
    .addEdge(START, "normalize_input")
    .addEdge("normalize_input", "symbolic_cas_verify")
    .addEdge("symbolic_cas_verify", "pedagogical_fsm")
    .addConditionalEdges("pedagogical_fsm", routeAfterFsm, {
      generate_followup_problem: "generate_followup_problem",
      prepare_pedagogical_context: "prepare_pedagogical_context",
    })
    .addEdge("generate_followup_problem", "prepare_pedagogical_context")
    .addEdge("prepare_pedagogical_context", "llm_socratic_tutor")
    .addEdge("llm_socratic_tutor", "socragate_guardrail")
    .addEdge("socragate_guardrail", END);

  return workflow.compile();
}

const compiledTutorGraph = createTutorLangGraph();

/**
 * Core Neuro-Symbolic Pedagogical Harness Entry Point powered by LangGraph (`@langchain/langgraph`).
 */
export async function runTutorHarnessTurn(
  input: TutorTurnInput
): Promise<TutorTurnOutput> {
  const finalState = await compiledTutorGraph.invoke({
    input,
    startMs: Date.now(),
  });

  if (!finalState.output) {
    throw new Error("LangGraph execution did not produce a TutorTurnOutput");
  }

  return finalState.output;
}
