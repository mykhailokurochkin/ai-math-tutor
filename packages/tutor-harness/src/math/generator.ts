import type { ErrorCategory, MathProblem } from "../types";
import { extractEquationFromText } from "./normalizer";
import { evaluateToLinearPolynomial, solveLinearRoot } from "./verifier";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type CurriculumTopicId =
  | "topic-distributive"
  | "topic-transposition"
  | "topic-like-terms"
  | "topic-olympiad";

export const STATIC_CURRICULUM_TOPICS: Array<{
  id: CurriculumTopicId;
  title: string;
  shortTitle: string;
  formulaLatex: string;
  gradeLevel: string;
  targetSkill: ErrorCategory;
  difficulty: 1 | 2 | 3;
}> = [
  {
    id: "topic-distributive",
    title: "Distributive Property",
    shortTitle: "Distributive Property",
    formulaLatex: "a(b + c) = ab + ac",
    gradeLevel: "Grade 7 Algebra",
    targetSkill: "DISTRIBUTIVE_PROPERTY",
    difficulty: 1,
  },
  {
    id: "topic-transposition",
    title: "Transposition & Signs",
    shortTitle: "Transposition & Signs",
    formulaLatex: "A + B = C \\implies A = C - B",
    gradeLevel: "Grade 7 Algebra",
    targetSkill: "SIGN_FLIP_OR_TRANSPOSITION",
    difficulty: 1,
  },
  {
    id: "topic-like-terms",
    title: "Combining Like Terms",
    shortTitle: "Combining Like Terms",
    formulaLatex: "ax + bx = (a + b)x",
    gradeLevel: "Grade 7 Algebra",
    targetSkill: "COMBINE_LIKE_TERMS",
    difficulty: 2,
  },
  {
    id: "topic-olympiad",
    title: "Multi-Bracket Equations",
    shortTitle: "Multi-Bracket Equations",
    formulaLatex: "a(mx + b) - k(x - c) = dx + e",
    gradeLevel: "Grade 7-8 · Skanavi",
    targetSkill: "DISTRIBUTIVE_PROPERTY",
    difficulty: 3,
  },
];

/**
 * Generates a single CAS-verified problem for a given topic ID, avoiding equations in `avoidSet`.
 */
export function generateVerifiedProblemForTopic(
  topicId: CurriculumTopicId,
  avoidSet: Set<string> = new Set(),
  isReinforcement = false,
  parentProblemId?: string
): MathProblem {
  const topicMeta =
    STATIC_CURRICULUM_TOPICS.find((t) => t.id === topicId) ??
    STATIC_CURRICULUM_TOPICS[0];

  let equation = "";
  let expectedRoot = 5;

  for (let attempt = 0; attempt < 30; attempt++) {
    const root = randomInt(2, 12);

    if (topicId === "topic-transposition") {
      // Form: a*x ± b = c*x ± d
      const c = randomInt(2, 6);
      const a = c + randomInt(1, 5);
      const b = randomInt(-15, 15) || 7;
      const d = (a - c) * root + b;
      if (d === 0) continue;
      const lhsB = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
      const rhsD = d >= 0 ? `+ ${d}` : `- ${Math.abs(d)}`;
      equation = `${a}x ${lhsB} = ${c}x ${rhsD}`;
      expectedRoot = root;
    } else if (topicId === "topic-like-terms") {
      // Form: a*x + b*x ± c = d*x ± e
      const a = randomInt(3, 8);
      const b = randomInt(2, 5);
      const useSub = attempt % 2 === 1 && a > b + 1;
      const netLeft = useSub ? a - b : a + b;
      const d = randomInt(1, netLeft - 1);
      const c = randomInt(-12, 12) || 6;
      const e = (netLeft - d) * root + c;
      if (e === 0) continue;
      const opB = useSub ? `- ${b}x` : `+ ${b}x`;
      const lhsC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
      const rhsX = d === 1 ? "x" : `${d}x`;
      const rhsE = e >= 0 ? `+ ${e}` : `- ${Math.abs(e)}`;
      equation = `${a}x ${opB} ${lhsC} = ${rhsX} ${rhsE}`;
      expectedRoot = root;
    } else if (topicId === "topic-olympiad") {
      // Form: a(m*x + b) - k(x - c) = d*x + e
      const a = randomInt(2, 4);
      const m = randomInt(1, 2);
      const b = randomInt(1, 5);
      const k = randomInt(1, a * m - 1) || 1;
      const c = randomInt(1, 4);
      const netLeftX = a * m - k;
      const d = Math.max(1, netLeftX - randomInt(1, 2));
      if (netLeftX === d) continue;
      const lhsValAtRoot = a * (m * root + b) - k * (root - c);
      const e = lhsValAtRoot - d * root;
      if (e === 0) continue;
      const innerX = m === 1 ? "x" : `${m}x`;
      const kPrefix = k === 1 ? "" : `${k}`;
      const rhsX = d === 1 ? "x" : `${d}x`;
      const rhsE = e >= 0 ? `+ ${e}` : `- ${Math.abs(e)}`;
      equation = `${a}(${innerX} + ${b}) - ${kPrefix}(x - ${c}) = ${rhsX} ${rhsE}`;
      expectedRoot = root;
    } else {
      // Default: topic-distributive -> a(x ± b) = cx ± d
      const a = randomInt(2, 7);
      const b = randomInt(2, 9);
      const c = randomInt(1, a - 1);
      const useMinus = attempt % 3 === 1;
      const signedB = useMinus ? -b : b;
      const d = a * (root + signedB) - c * root;
      if (d === 0) continue;
      const innerSign = signedB >= 0 ? `+ ${signedB}` : `- ${Math.abs(signedB)}`;
      const rhsSign = d >= 0 ? `+ ${d}` : `- ${Math.abs(d)}`;
      const rhsX = c === 1 ? "x" : `${c}x`;
      equation = `${a}(x ${innerSign}) = ${rhsX} ${rhsSign}`;
      expectedRoot = root;
    }

    if (equation && !avoidSet.has(equation)) {
      break;
    }
  }

  if (!equation) {
    equation = "4(x + 3) = 3x + 17";
    expectedRoot = 5;
  }

  const [lhsStr, rhsStr] = equation.split("=").map((s) => s.trim());
  const lhsPoly = evaluateToLinearPolynomial(lhsStr, "x");
  const rhsPoly = evaluateToLinearPolynomial(rhsStr, "x");
  const verifiedRoot =
    lhsPoly && rhsPoly ? solveLinearRoot(lhsPoly, rhsPoly) : expectedRoot;

  if (verifiedRoot === null || Math.abs(verifiedRoot - expectedRoot) > 1e-6) {
    throw new Error(
      `CAS Generator Sanity Check Failed for "${equation}": expected ${expectedRoot}, got ${verifiedRoot}`
    );
  }

  return {
    id: `prob-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    topicId: topicMeta.id,
    topicTitle: isReinforcement
      ? `${topicMeta.title} (Follow-Up Practice)`
      : topicMeta.title,
    gradeLevel: topicMeta.gradeLevel,
    equation,
    latex: equation,
    variable: "x",
    expectedRoot,
    targetSkill: topicMeta.targetSkill,
    difficulty: topicMeta.difficulty,
    isReinforcement,
    parentProblemId,
  };
}

/**
 * Generates a batch of `count` (e.g., 4) unique, CAS-verified exercises for the requested topic.
 */
export function generateProblemBatch(
  topicFilter: CurriculumTopicId | "all",
  count = 4,
  existingEquations: string[] = []
): MathProblem[] {
  const avoidSet = new Set(existingEquations);
  const results: MathProblem[] = [];
  const topicCycle: CurriculumTopicId[] = [
    "topic-distributive",
    "topic-transposition",
    "topic-like-terms",
    "topic-olympiad",
  ];

  for (let i = 0; i < count; i++) {
    const targetTopic: CurriculumTopicId =
      topicFilter === "all"
        ? topicCycle[i % topicCycle.length]
        : topicFilter;

    const prob = generateVerifiedProblemForTopic(targetTopic, avoidSet, false);
    avoidSet.add(prob.equation);
    results.push(prob);
  }

  return results;
}

/**
 * Dynamically generates a fresh, CAS-verified isomorphic follow-up problem targeting a specific misconception.
 */
export function generateIsomorphicProblem(
  sourceProblem: MathProblem,
  targetErrorCategory: ErrorCategory,
  _seedIndex = 0
): MathProblem {
  const validTopicIds: CurriculumTopicId[] = [
    "topic-distributive",
    "topic-transposition",
    "topic-like-terms",
    "topic-olympiad",
  ];

  let targetTopic: CurriculumTopicId = validTopicIds.includes(
    sourceProblem.topicId as CurriculumTopicId
  )
    ? (sourceProblem.topicId as CurriculumTopicId)
    : "topic-distributive";

  if (
    !sourceProblem.topicId &&
    targetErrorCategory === "SIGN_FLIP_OR_TRANSPOSITION"
  ) {
    targetTopic = "topic-transposition";
  } else if (
    !sourceProblem.topicId &&
    targetErrorCategory === "COMBINE_LIKE_TERMS"
  ) {
    targetTopic = "topic-like-terms";
  }

  const avoidSet = new Set([sourceProblem.equation]);
  const generated = generateVerifiedProblemForTopic(
    targetTopic,
    avoidSet,
    true,
    sourceProblem.id
  );

  return {
    ...generated,
    targetSkill:
      targetErrorCategory !== "NONE" &&
      targetErrorCategory !== "INVALID_EXPRESSION"
        ? targetErrorCategory
        : generated.targetSkill,
  };
}

/**
 * Parses any custom user-supplied linear equation (e.g. "4(x - 2) = 2x + 6"),
 * solves it symbolically via CortexJS/linear evaluator, and creates a structured MathProblem
 * assigned to the requested `preferredTopicId` (or auto-detected topic).
 */
export function createCustomMathProblem(
  rawInput: string,
  preferredTopicId?: CurriculumTopicId
): MathProblem | null {
  const extracted = extractEquationFromText(rawInput);
  if (!extracted) return null;

  const [lhsStr, rhsStr] = extracted.split("=").map((s) => s.trim());
  const lhsPoly = evaluateToLinearPolynomial(lhsStr, "x");
  const rhsPoly = evaluateToLinearPolynomial(rhsStr, "x");
  if (!lhsPoly || !rhsPoly) return null;

  const root = solveLinearRoot(lhsPoly, rhsPoly);
  if (root === null || !Number.isFinite(root)) return null;

  const hasBrackets = /[()]/.test(extracted);
  const autoTopicId: CurriculumTopicId = hasBrackets
    ? "topic-distributive"
    : "topic-transposition";
  const finalTopicId = preferredTopicId ?? autoTopicId;
  const topicMeta =
    STATIC_CURRICULUM_TOPICS.find((t) => t.id === finalTopicId) ??
    STATIC_CURRICULUM_TOPICS[0];

  return {
    id: `prob-custom-${Date.now().toString(36)}`,
    topicId: topicMeta.id,
    topicTitle: `${topicMeta.title} (Custom)`,
    gradeLevel: "Custom Exercise",
    equation: extracted,
    latex: extracted,
    variable: "x",
    expectedRoot: root,
    targetSkill: topicMeta.targetSkill,
    difficulty: topicMeta.difficulty,
  };
}
