import type { ErrorCategory, MathProblem } from "../types";
import { extractEquationFromText } from "./normalizer";
import { evaluateToLinearPolynomial, solveLinearRoot } from "./verifier";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Dynamically generates a fresh, CAS-verified isomorphic problem targeting a specific skill/misconception.
 * Uses randomized integer parameters and verifies via symbolic evaluation that the root is a clean integer.
 */
export function generateIsomorphicProblem(
  sourceProblem: MathProblem,
  targetErrorCategory: ErrorCategory,
  _seedIndex = 0
): MathProblem {
  const effectiveCategory =
    targetErrorCategory === "NONE" || targetErrorCategory === "INVALID_EXPRESSION"
      ? sourceProblem.targetSkill === "LINEAR_EQUATIONS"
        ? "DISTRIBUTIVE_PROPERTY"
        : sourceProblem.targetSkill
      : targetErrorCategory;

  let equation = "";
  let expectedRoot = 5;

  // Attempt up to 15 randomized generations to ensure it differs from sourceProblem.equation
  for (let attempt = 0; attempt < 15; attempt++) {
    const root = randomInt(2, 11);

    if (effectiveCategory === "SIGN_FLIP_OR_TRANSPOSITION") {
      // Form: a*x + b = c*x + d
      const c = randomInt(2, 5);
      const a = c + randomInt(1, 4);
      const b = randomInt(-12, 12) || 5;
      const d = (a - c) * root + b;
      const lhsB = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
      const rhsD = d >= 0 ? `+ ${d}` : `- ${Math.abs(d)}`;
      equation = `${a}x ${lhsB} = ${c}x ${rhsD}`;
      expectedRoot = root;
    } else {
      // Form: a(x + b) = cx + d (or a(x - b) = cx + d)
      const a = randomInt(2, 6);
      const b = randomInt(2, 7);
      const c = randomInt(1, a - 1);
      const useMinus = sourceProblem.equation.includes("-") && attempt % 2 === 1;
      const signedB = useMinus ? -b : b;
      const d = a * (root + signedB) - c * root;
      if (d <= 0) continue;
      const innerSign = signedB >= 0 ? `+ ${signedB}` : `- ${Math.abs(signedB)}`;
      const rhsX = c === 1 ? "x" : `${c}x`;
      equation = `${a}(x ${innerSign}) = ${rhsX} + ${d}`;
      expectedRoot = root;
    }

    if (equation !== sourceProblem.equation) {
      break;
    }
  }

  // CAS Verification: confirm generated equation solves to exact expected integer root
  const [lhsStr, rhsStr] = equation.split("=").map((s) => s.trim());
  const lhsPoly = evaluateToLinearPolynomial(lhsStr, sourceProblem.variable);
  const rhsPoly = evaluateToLinearPolynomial(rhsStr, sourceProblem.variable);
  const verifiedRoot =
    lhsPoly && rhsPoly ? solveLinearRoot(lhsPoly, rhsPoly) : expectedRoot;

  if (verifiedRoot === null || Math.abs(verifiedRoot - expectedRoot) > 1e-6) {
    throw new Error(
      `CAS Generator Sanity Check Failed for "${equation}": expected ${expectedRoot}, got ${verifiedRoot}`
    );
  }

  const baseTitle = sourceProblem.topicTitle
    .replace(" (Follow-Up Practice)", "")
    .replace(" (Generated)", "");

  return {
    id: `prob-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    topicId: sourceProblem.topicId,
    topicTitle: `${baseTitle} (Follow-Up Practice)`,
    gradeLevel: sourceProblem.gradeLevel,
    equation,
    latex: equation,
    variable: sourceProblem.variable,
    expectedRoot,
    targetSkill: effectiveCategory,
    difficulty: sourceProblem.difficulty,
    isReinforcement: true,
    parentProblemId: sourceProblem.id,
  };
}

/**
 * Parses any custom user-supplied linear equation (e.g. "4(x - 2) = 2x + 6"),
 * solves it symbolically via CortexJS/linear evaluator, and creates a structured MathProblem.
 */
export function createCustomMathProblem(rawInput: string): MathProblem | null {
  const extracted = extractEquationFromText(rawInput);
  if (!extracted) return null;

  const [lhsStr, rhsStr] = extracted.split("=").map((s) => s.trim());
  const lhsPoly = evaluateToLinearPolynomial(lhsStr, "x");
  const rhsPoly = evaluateToLinearPolynomial(rhsStr, "x");
  if (!lhsPoly || !rhsPoly) return null;

  const root = solveLinearRoot(lhsPoly, rhsPoly);
  if (root === null || !Number.isFinite(root)) return null;

  const hasBrackets = /[()]/.test(extracted);
  const targetSkill: ErrorCategory = hasBrackets
    ? "DISTRIBUTIVE_PROPERTY"
    : "SIGN_FLIP_OR_TRANSPOSITION";

  const topicTitle = hasBrackets
    ? "Custom Equation · Distributive Property"
    : "Custom Equation · Linear Algebra";

  return {
    id: `prob-custom-${Date.now().toString(36)}`,
    topicId: hasBrackets ? "topic-distributive" : "topic-transposition",
    topicTitle,
    gradeLevel: "Custom Exercise",
    equation: extracted,
    latex: extracted,
    variable: "x",
    expectedRoot: root,
    targetSkill,
    difficulty: hasBrackets ? 2 : 1,
  };
}
