export type ErrorCategory =
  | "NONE"
  | "DISTRIBUTIVE_PROPERTY"
  | "SIGN_FLIP_OR_TRANSPOSITION"
  | "COMBINE_LIKE_TERMS"
  | "DIVISION_OR_ISOLATION"
  | "ARITHMETIC_OR_ALGEBRAIC"
  | "INVALID_EXPRESSION";

export type PedagogicalPhase =
  | "SOLVING"
  | "SOCRATIC_GUIDE"
  | "WORKED_EXAMPLE"
  | "REINFORCEMENT"
  | "MASTERED";

export type HintLevel = 0 | 1 | 2 | 3;

export type InputClassification =
  | "MATH_STEP"
  | "SUB_STEP_VALUE"
  | "CONCEPTUAL_REPLY"
  | "HINT_REQUEST"
  | "GIVE_UP_REQUEST"
  | "WORKED_EXAMPLE_REQUEST";

export interface MathProblem {
  id: string;
  topicId: string;
  topicTitle: string;
  gradeLevel: string;
  equation: string;
  latex: string;
  variable: string;
  expectedRoot: number;
  targetSkill: ErrorCategory | "LINEAR_EQUATIONS";
  difficulty: 1 | 2 | 3;
  isReinforcement?: boolean;
  parentProblemId?: string;
}

export interface LinearPolynomial {
  /** Coefficient of x (A in Ax + B) */
  a: number;
  /** Constant term (B in Ax + B) */
  b: number;
  /** Formatted canonical form e.g. "3x + 12" */
  formatted: string;
}

export interface VerificationResult {
  hasMathExpression: boolean;
  extractedEquation: string | null;
  normalizedLatex: string | null;
  isEquivalentToTarget: boolean;
  isFinalSolvedStep: boolean;
  isTrivialCopy: boolean;
  isValidProgressStep: boolean;
  studentRoot: number | null;
  targetRoot: number;
  lhsStudent: LinearPolynomial | null;
  rhsStudent: LinearPolynomial | null;
  lhsExpected: LinearPolynomial;
  rhsExpected: LinearPolynomial;
  errorCategory: ErrorCategory;
  diagnosticSummary: string;
  specificDiscrepancy?: string;
  expectedNextCanonicalStep?: string;
}

export interface FSMState {
  phase: PedagogicalPhase;
  hintLevel: HintLevel;
  failedAttemptsOnCurrentStep: number;
  totalMistakesInProblem: number;
  hadMistakeInProblem: boolean;
  wasAssisted: boolean;
  lastValidEquation: string;
  activeErrorCategory: ErrorCategory;
}

export interface FSMTransitionTrace {
  from: PedagogicalPhase;
  to: PedagogicalPhase;
  prevHintLevel: HintLevel;
  nextHintLevel: HintLevel;
  failedAttemptsOnStep: number;
  reason: string;
}

export interface CurriculumRule {
  id: string;
  errorCategory: ErrorCategory;
  titleUk: string;
  titleEn: string;
  formulaLatex: string;
  ussrMethodologyNote: string;
  socraticHints: {
    level1: string;
    level2Template: string;
    level3Template: string;
  };
}

export interface GuardrailCheckTrace {
  checked: boolean;
  intercepted: boolean;
  leakedTokens: string[];
  actionTaken:
    | "PASSED"
    | "REGENERATED"
    | "FALLBACK_SAFE_SOCRATIC"
    | "BYPASSED_FOR_WORKED_EXAMPLE";
}

export interface HarnessTrace {
  timestamp: string;
  inputRaw: string;
  inputClassification: InputClassification;
  verification: VerificationResult;
  fsmTransition: FSMTransitionTrace;
  curriculumLookup: {
    ruleId: string;
    ruleTitle: string;
    formulaLatex: string;
    ussrMethodologyNote: string;
  } | null;
  hiddenScratchpad: {
    forbiddenReveals: string[];
    pedagogicalDirective: string;
  };
  guardrailCheck: GuardrailCheckTrace;
  generatedFollowUpProblem?: MathProblem;
  llmProvider: string;
  latencyMs: number;
}

export interface TutorTurnInput {
  problem: MathProblem;
  fsmState: FSMState;
  studentMessage: string;
  conversationHistory?: Array<{ role: "student" | "tutor"; content: string }>;
  requestWorkedExample?: boolean;
  previousErrorsCountByCategory?: Partial<Record<ErrorCategory, number>>;
}

export interface TutorTurnOutput {
  tutorMessage: string;
  nextFsmState: FSMState;
  verification: VerificationResult;
  trace: HarnessTrace;
  followUpProblem?: MathProblem;
  stepStatus: "CORRECT_INTERMEDIATE" | "CORRECT_FINAL" | "ERROR_DETECTED" | "GUIDANCE_TURN" | "WORKED_EXAMPLE_GIVEN";
}
