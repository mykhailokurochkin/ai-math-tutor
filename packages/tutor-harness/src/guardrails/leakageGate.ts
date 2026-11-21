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

/**
 * Builds the list of forbidden answer strings that must NOT appear in a Socratic response
 * during SOLVING or SOCRATIC_GUIDE phases.
 */
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
    `відповідь: ${r}`,
    `відповідь ${r}`,
    `корінь ${r}`,
    `дорівнює ${r}`,
  ];

  // On Hint Level 1, also forbid leaking the full corrected canonical equation step directly
  if (
    hintLevel <= 1 &&
    verification.expectedNextCanonicalStep &&
    verification.expectedNextCanonicalStep !== `${v} = ${r}`
  ) {
    forbidden.push(verification.expectedNextCanonicalStep);
  }

  return forbidden;
}

/**
 * Generates a deterministic, pedagogically sound fallback Socratic response
 * if the LLM attempts to leak the final answer or fails guardrail checks.
 */
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
      return `Не поспішай! У кроці $${verification.extractedEquation ?? problem.equation}$ є неточність при розкритті дужок. Згадай розподільний закон множення $a(b + c) = ab + ac$: коли перед дужками стоїть множник, на які доданки всередині дужок його потрібно помножити?`;
    }
    if (hintLevel === 2) {
      return `Поглянь уважно на ліву частину рівняння $${problem.equation.split("=")[0].trim()}$: ти записав $${lhsStudent || "перший доданок"}$, тобто помножив число перед дужками лише на $x$. А що має статися з другим доданком у дужках?`;
    }
    const expectedConstant = Math.abs(verification.lhsExpected.b);
    const sign = verification.lhsExpected.b >= 0 ? "+" : "-";
    return `Давай розберемо ліву частину майже до кінця: перший доданок $${verification.lhsExpected.a}x$ ти знайшов правильно. Після множення числа перед дужками на другий доданок у дужках отримуємо $${sign} ${expectedConstant}$ (тобто ліва частина має вигляд $${lhsExpected}$). Як тепер запишеться все рівняння разом із правою частиною?`;
  }

  if (rule) {
    if (hintLevel === 1) return rule.socraticHints.level1;
    if (hintLevel === 2) return rule.socraticHints.level2Template;
    return rule.socraticHints.level3Template;
  }

  return `Давай перевіримо останній крок у рівнянні $${problem.equation}$: яка дія має бути виконана з обома частинами рівняння, щоб зберегти рівність?`;
}

/**
 * Output-Admission Control (SocraGate pattern):
 * Inspects candidate LLM output against forbidden solution tokens before returning it to the student.
 */
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

  // Leak detected! Replace with deterministic safe Socratic fallback
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
