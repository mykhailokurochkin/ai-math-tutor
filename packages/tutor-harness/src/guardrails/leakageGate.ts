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
  const category: ErrorCategory =
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : activeErrorCategory !== "NONE"
        ? activeErrorCategory
        : problem.targetSkill !== "LINEAR_EQUATIONS"
          ? problem.targetSkill
          : /[()]/.test(problem.equation)
            ? "DISTRIBUTIVE_PROPERTY"
            : "SIGN_FLIP_OR_TRANSPOSITION";

  const rule = lookupCurriculumRule(category);
  const lhsRaw = problem.equation.split("=")[0]?.trim() ?? problem.equation;
  const hasStudentError = verification.hasMathExpression && !verification.isEquivalentToTarget;

  if (category === "DISTRIBUTIVE_PROPERTY") {
    const lhsExpected = verification.lhsExpected.formatted;
    const lhsStudent = verification.lhsStudent?.formatted ?? "";
    const expectedConstant = Math.abs(verification.lhsExpected.b);
    const sign = verification.lhsExpected.b >= 0 ? "+" : "-";

    if (hintLevel === 1) {
      if (hasStudentError) {
        return `Hold on! Let's look closely at your step $${verification.extractedEquation ?? problem.equation}$. Recall the distributive property of multiplication $a(b + c) = ab + ac$: when a multiplier stands outside the parentheses, which terms inside the parentheses must it multiply?`;
      }
      return `Let's start with the parentheses in $${problem.equation}$. Recall the distributive property $a(b + c) = ab + ac$: when a number stands outside the parentheses in $${lhsRaw}$, which terms inside must it multiply?`;
    }
    if (hintLevel === 2) {
      if (hasStudentError) {
        return `Look at the left side $${lhsRaw}$: you wrote $${lhsStudent || "the first term"}$, meaning you multiplied the outside factor by $x$, but what happened to the second term inside the parentheses?`;
      }
      return `Focus specifically on expanding $${lhsRaw}$: multiply the outside factor by $x$ first, and then multiply that same factor by the constant term inside the parentheses. What two terms do you get for the left side?`;
    }
    return `Let's break down the left side together: the first term is $${verification.lhsExpected.a}x$, and multiplying the outside factor by the second term inside the brackets gives $${sign} ${expectedConstant}$ (so the left side expands to $${lhsExpected}$). How should you write the full equation now with the right side included?`;
  }

  if (rule) {
    if (hintLevel === 1) return rule.socraticHints.level1;
    if (hintLevel === 2) return rule.socraticHints.level2Template;
    return rule.socraticHints.level3Template;
  }

  if (hintLevel === 1) {
    return `Look at the equation $${problem.equation}$: what is the first algebraic operation that simplifies one side without changing the solution?`;
  }
  if (hintLevel === 2) {
    return `Try grouping all terms containing $${problem.variable}$ on the left side and constant numbers on the right side of $${problem.equation}$. Remember to flip signs when moving across \`=\`!`;
  }
  return `Combine the $${problem.variable}$-terms and constants on each side of $${problem.equation}$ into the form $a${problem.variable} = b$. What simplified equation do you get?`;
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
