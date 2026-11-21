import type {
  ErrorCategory,
  GuardrailCheckTrace,
  HintLevel,
  MathProblem,
  PedagogicalPhase,
  VerificationResult,
} from "../types";
import { lookupCurriculumRule } from "../config/pedagogyConfig";

export interface LeakageCheckResult {
  safeResponse: string;
  trace: GuardrailCheckTrace;
}

export function getForbiddenReveals(
  problem: MathProblem,
  verification: VerificationResult,
  phase: PedagogicalPhase,
  hintLevel: HintLevel
): string[] {
  if (
    phase === "WORKED_EXAMPLE" ||
    phase === "MASTERED" ||
    (phase === "REINFORCEMENT" && verification.isFinalSolvedStep)
  ) {
    return [];
  }

  const v = problem.variable;
  const r = problem.expectedRoot;
  const forbidden: string[] = [
    `${v} = ${r}`,
    `${v}=${r}`,
    `${r} = ${v}`,
    `${r}=${v}`,
    `answer is ${r}`,
    `root is ${r}`,
    `equals ${r}`,
    `відповідь: ${r}`,
    `відповідь ${r}`,
  ];

  if (
    hintLevel <= 1 &&
    verification.expectedNextCanonicalStep &&
    verification.expectedNextCanonicalStep !== `${v} = ${r}`
  ) {
    forbidden.push(verification.expectedNextCanonicalStep);
  }

  return forbidden;
}

export function buildSafeSocraticFallback(
  problem: MathProblem,
  verification: VerificationResult,
  hintLevel: HintLevel,
  activeErrorCategory: ErrorCategory
): string {
  const category =
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : activeErrorCategory;
  const rule = lookupCurriculumRule(category);

  if (category === "DISTRIBUTIVE_PROPERTY") {
    const lhsExpected = verification.lhsExpected.formatted;
    const lhsStudent = verification.lhsStudent?.formatted ?? "";
    if (hintLevel === 1) {
      return `Hold on! Let's look closely at your step $${verification.extractedEquation ?? problem.equation}$. Recall the distributive property of multiplication $a(b + c) = ab + ac$: when a multiplier stands outside the parentheses, which terms inside the parentheses must it multiply?`;
    }
    if (hintLevel === 2) {
      return `Look at the left side of the equation $${problem.equation.split("=")[0].trim()}$: you wrote $${lhsStudent || "the first term"}$, meaning you multiplied the outside factor by $x$, but what happened to the second term inside the parentheses?`;
    }
    const expectedConstant = Math.abs(verification.lhsExpected.b);
    const sign = verification.lhsExpected.b >= 0 ? "+" : "-";
    return `Let's break down the left side together: your first term $${verification.lhsExpected.a}x$ is correct. Multiplying the outside factor by the second term inside the brackets gives $${sign} ${expectedConstant}$ (so the left side expands to $${lhsExpected}$). How should the full equation be written now?`;
  }

  if (rule) {
    if (hintLevel === 1) return rule.socraticHints.level1;
    if (hintLevel === 2) return rule.socraticHints.level2Template;
    return rule.socraticHints.level3Template;
  }

  return `Let's examine your last step in $${problem.equation}$: what operation should we apply to both sides of the equation to preserve equality?`;
}

export function enforceLeakageGate(
  candidateResponse: string,
  problem: MathProblem,
  verification: VerificationResult,
  phase: PedagogicalPhase,
  hintLevel: HintLevel,
  activeErrorCategory: ErrorCategory
): LeakageCheckResult {
  if (
    phase === "WORKED_EXAMPLE" ||
    phase === "MASTERED" ||
    (phase === "REINFORCEMENT" && verification.isFinalSolvedStep)
  ) {
    return {
      safeResponse: candidateResponse,
      trace: {
        checked: false,
        intercepted: false,
        leakedTokens: [],
        actionTaken: "BYPASSED_FOR_WORKED_EXAMPLE",
      },
    };
  }

  const forbidden = getForbiddenReveals(problem, verification, phase, hintLevel);
  const normalizedCandidate = candidateResponse.replace(/\s+/g, " ").toLowerCase();
  const compactCandidate = candidateResponse.replace(/\s+/g, "").toLowerCase();

  const leakedTokens: string[] = [];
  for (const token of forbidden) {
    const normToken = token.replace(/\s+/g, " ").toLowerCase();
    const compactToken = token.replace(/\s+/g, "").toLowerCase();
    if (
      normalizedCandidate.includes(normToken) ||
      compactCandidate.includes(compactToken)
    ) {
      leakedTokens.push(token);
    }
  }

  if (leakedTokens.length === 0) {
    return {
      safeResponse: candidateResponse,
      trace: {
        checked: true,
        intercepted: false,
        leakedTokens: [],
        actionTaken: "PASSED",
      },
    };
  }

  const fallback = buildSafeSocraticFallback(
    problem,
    verification,
    hintLevel || 1,
    activeErrorCategory
  );

  return {
    safeResponse: fallback,
    trace: {
      checked: true,
      intercepted: true,
      leakedTokens,
      actionTaken: "FALLBACK_SAFE_SOCRATIC",
    },
  };
}
