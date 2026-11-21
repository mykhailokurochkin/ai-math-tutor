import curriculumData from "../../config/CURRICULUM.json";
import type { CurriculumRule, ErrorCategory, MathProblem } from "../types";

export const PEDAGOGY_DIRECTIVES_MD = `
# USSR Classical Math Methodology & Socratic Alignment (Kiselev / Makarychev / LearnLM)
1. Rely strictly on the deterministic <HIDDEN_SYMBOLIC_SCRATCHPAD> provided by the Math Verifier.
2. During SOLVING and SOCRATIC_GUIDE (Hint Levels 1, 2, 3), NEVER reveal the final root or solve the problem for the student.
3. End every Socratic guidance turn with AT MOST ONE clear guiding question ("One Question Rule").
4. Escalate scaffolding gradually:
   - Hint Level 1: Conceptual prompt pointing to the mathematical law (e.g., Distributive Property a(b+c) = ab + ac).
   - Hint Level 2: Focus the student's attention on the exact term/sign where the discrepancy occurred.
   - Hint Level 3: Ask the student to compute one atomic arithmetic sub-step.
5. In WORKED_EXAMPLE phase (after 3 failed attempts), provide a clear, encouraging step-by-step explanation of the stuck step and transition to the reinforcement problem.
6. Communicate in clear, encouraging academic English, using LaTeX ($...$) for mathematical expressions.
`.trim();

export const CURRICULUM_RULES: CurriculumRule[] =
  curriculumData.rules as CurriculumRule[];

export const DEFAULT_PROBLEMS: MathProblem[] =
  curriculumData.defaultProblems as MathProblem[];

export function lookupCurriculumRule(
  category: ErrorCategory
): CurriculumRule | null {
  return (
    CURRICULUM_RULES.find((rule) => rule.errorCategory === category) ?? null
  );
}

export function getTestScenarioProblem(): MathProblem {
  return DEFAULT_PROBLEMS[0];
}
