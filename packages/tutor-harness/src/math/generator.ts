import type { ErrorCategory, MathProblem } from "../types";
import { evaluateToLinearPolynomial, solveLinearRoot } from "./verifier";

interface IsomorphicTemplate {
  a: number;
  b: number;
  c: number;
  root: number;
  sign: "+" | "-";
}

const DISTRIBUTIVE_TEMPLATES: IsomorphicTemplate[] = [
  { a: 4, b: 3, c: 3, root: 5, sign: "+" }, // 4(x + 3) = 3x + 17 -> 4x + 12 = 3x + 17 -> x = 5
  { a: 5, b: 2, c: 4, root: 6, sign: "+" }, // 5(x + 2) = 4x + 16 -> 5x + 10 = 4x + 16 -> x = 6
  { a: 2, b: 5, c: 1, root: 4, sign: "+" }, // 2(x + 5) = x + 14  -> 2x + 10 = x + 14  -> x = 4
  { a: 6, b: 2, c: 4, root: 3, sign: "+" }, // 6(x + 2) = 4x + 18 -> 6x + 12 = 4x + 18 -> x = 3
  { a: 3, b: 5, c: 2, root: 8, sign: "+" }, // 3(x + 5) = 2x + 23 -> 3x + 15 = 2x + 23 -> x = 8
];

const TRANSPOSITION_TEMPLATES = [
  { a: 5, b: -7, c: 3, root: 6 }, // 5x - 7 = 3x + 5 -> 2x = 12 -> x = 6
  { a: 6, b: -9, c: 4, root: 7 }, // 6x - 9 = 4x + 5 -> 2x = 14 -> x = 7
  { a: 4, b: 5, c: 2, root: 4 },  // 4x + 5 = 2x + 13 -> 2x = 8 -> x = 4
];

/**
 * Deterministically generates and CAS-verifies a similar problem targeting the student's misconception.
 * Guarantees a clean integer root verified by the symbolic engine.
 */
export function generateIsomorphicProblem(
  sourceProblem: MathProblem,
  targetErrorCategory: ErrorCategory,
  seedIndex = 0
): MathProblem {
  const effectiveCategory =
    targetErrorCategory === "NONE" || targetErrorCategory === "INVALID_EXPRESSION"
      ? sourceProblem.targetSkill === "LINEAR_EQUATIONS"
        ? "DISTRIBUTIVE_PROPERTY"
        : sourceProblem.targetSkill
      : targetErrorCategory;

  let equation = "";
  let expectedRoot = 5;

  if (effectiveCategory === "SIGN_FLIP_OR_TRANSPOSITION") {
    const tpl =
      TRANSPOSITION_TEMPLATES[seedIndex % TRANSPOSITION_TEMPLATES.length];
    // a*x + b = c*x + d => d = (a - c)*root + b
    const d = (tpl.a - tpl.c) * tpl.root + tpl.b;
    const lhsB = tpl.b >= 0 ? `+ ${tpl.b}` : `- ${Math.abs(tpl.b)}`;
    const rhsD = d >= 0 ? `+ ${d}` : `- ${Math.abs(d)}`;
    equation = `${tpl.a}x ${lhsB} = ${tpl.c}x ${rhsD}`;
    expectedRoot = tpl.root;
  } else {
    // Default / DISTRIBUTIVE_PROPERTY / COMBINE_LIKE_TERMS / DIVISION_OR_ISOLATION:
    // Use structural form a(x + b) = cx + d
    const candidates = DISTRIBUTIVE_TEMPLATES.filter((t) => {
      const d = t.a * (t.root + t.b) - t.c * t.root;
      const eq = `${t.a}(x + ${t.b}) = ${t.c === 1 ? "" : t.c}x + ${d}`;
      return eq !== sourceProblem.equation;
    });
    const tpl = candidates[seedIndex % candidates.length] ?? DISTRIBUTIVE_TEMPLATES[0];
    const d = tpl.a * (tpl.root + tpl.b) - tpl.c * tpl.root;
    const rhsX = tpl.c === 1 ? "x" : `${tpl.c}x`;
    equation = `${tpl.a}(x + ${tpl.b}) = ${rhsX} + ${d}`;
    expectedRoot = tpl.root;
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

  return {
    id: `${sourceProblem.id}-reinforce-${Date.now().toString(36)}`,
    topicId: sourceProblem.topicId,
    topicTitle: `${sourceProblem.topicTitle} (Закріплення)`,
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
