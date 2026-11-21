import { ComputeEngine } from "@cortex-js/compute-engine";
import type {
  ErrorCategory,
  LinearPolynomial,
  VerificationResult,
} from "../types";
import { asciiToLatex, normalizeStudentInput, sanitizeMathCharacters } from "./normalizer";

const ce = new ComputeEngine();

/**
 * Formats a linear polynomial Ax + B into clean canonical form e.g. "3x + 12", "x - 5", "7"
 */
export function formatLinearPolynomial(a: number, b: number, variable = "x"): string {
  const cleanA = Math.round(a * 10000) / 10000;
  const cleanB = Math.round(b * 10000) / 10000;

  if (Math.abs(cleanA) < 1e-9) {
    return `${cleanB}`;
  }

  let xPart = "";
  if (Math.abs(cleanA - 1) < 1e-9) {
    xPart = variable;
  } else if (Math.abs(cleanA + 1) < 1e-9) {
    xPart = `-${variable}`;
  } else {
    xPart = `${cleanA}${variable}`;
  }

  if (Math.abs(cleanB) < 1e-9) {
    return xPart;
  }

  const sign = cleanB > 0 ? "+" : "-";
  return `${xPart} ${sign} ${Math.abs(cleanB)}`;
}

/**
 * Evaluates a single algebraic expression in variable `x` into a LinearPolynomial (Ax + B).
 * Uses deterministic AST parser + CortexJS ComputeEngine validation.
 */
export function evaluateToLinearPolynomial(
  rawExpr: string,
  variable = "x"
): LinearPolynomial | null {
  try {
    const sanitized = sanitizeMathCharacters(rawExpr)
      .replace(/\s+/g, "")
      // Insert explicit multiplication: 3x -> 3*x, 3(x+4) -> 3*(x+4), (x+1)(2) -> (x+1)*(2), )x -> )*x
      .replace(new RegExp(`(\\d)(${variable})`, "gi"), "$1*$2")
      .replace(/(\d)\(/g, "$1*(")
      .replace(/\)\(/g, ")*(")
      .replace(new RegExp(`\\)(${variable}|\\d)`, "gi"), ")*$1")
      .replace(new RegExp(`(${variable})\\(`, "gi"), "$1*(");

    // Security check: allow only digits, variable, basic arithmetic operators, parentheses, decimal point
    const safePattern = new RegExp(`^[0-9+\\-*/().${variable}]+$`, "i");
    if (!sanitized || !safePattern.test(sanitized)) {
      return null;
    }

    // Parse with CortexJS ComputeEngine for structural AST validity
    const latexExpr = asciiToLatex(rawExpr);
    const boxed = ce.parse(latexExpr);
    if (!boxed.isValid) {
      return null;
    }

    const evalAt = (val: number): number => {
      const exprWithVal = sanitized.replace(
        new RegExp(variable, "gi"),
        `(${val})`
      );
      // Safe deterministic arithmetic evaluation (input already strictly whitelisted by safePattern)
      const fn = new Function(`"use strict"; return (${exprWithVal});`);
      const res = fn();
      if (typeof res !== "number" || !Number.isFinite(res)) {
        throw new Error("Non-finite result");
      }
      return res;
    };

    const f0 = evalAt(0);
    const f1 = evalAt(1);
    const f2 = evalAt(2);

    const b = f0;
    const a = f1 - f0;
    const aCheck = f2 - f1;

    // Verify linearity (first derivative is constant)
    if (Math.abs(a - aCheck) > 1e-6) {
      return null;
    }

    const cleanA = Math.round(a * 10000) / 10000;
    const cleanB = Math.round(b * 10000) / 10000;

    return {
      a: cleanA,
      b: cleanB,
      formatted: formatLinearPolynomial(cleanA, cleanB, variable),
    };
  } catch {
    return null;
  }
}

/**
 * Solves a linear equation LHS = RHS for its root x.
 * Returns null if degenerate (0x = c).
 */
export function solveLinearRoot(
  lhs: LinearPolynomial,
  rhs: LinearPolynomial
): number | null {
  const netA = lhs.a - rhs.a;
  const netB = rhs.b - lhs.b;
  if (Math.abs(netA) < 1e-9) {
    return null;
  }
  return Math.round((netB / netA) * 10000) / 10000;
}

/**
 * Detects specific bracket expansion errors like k(mx + c) -> (k*m)x + c
 */
function inspectBracketDiscrepancy(
  referenceEq: string,
  lhsExpected: LinearPolynomial,
  rhsExpected: LinearPolynomial,
  lhsStudent: LinearPolynomial,
  rhsStudent: LinearPolynomial
): { isDistributiveError: boolean; detail?: string } {
  const refHasBrackets = /[()]/.test(referenceEq);
  if (!refHasBrackets) {
    return { isDistributiveError: false };
  }

  // Case 1: LHS had brackets, RHS matched, LHS x-coeff matches but constant term is wrong
  const rhsMatches =
    Math.abs(rhsStudent.a - rhsExpected.a) < 1e-6 &&
    Math.abs(rhsStudent.b - rhsExpected.b) < 1e-6;

  if (
    rhsMatches &&
    Math.abs(lhsStudent.a - lhsExpected.a) < 1e-6 &&
    Math.abs(lhsStudent.b - lhsExpected.b) > 1e-6
  ) {
    // Check if reference LHS has pattern k(x + c) or k(mx + c)
    const refLhsRaw = referenceEq.split("=")[0]?.trim() ?? "";
    const bracketMatch = refLhsRaw.match(
      /([+-]?\d+)\s*\(\s*([+-]?\d*)\s*x\s*([+-]\s*\d+)\s*\)/i
    );
    if (bracketMatch) {
      const k = Number(bracketMatch[1]);
      const c = Number(bracketMatch[3].replace(/\s+/g, ""));
      if (Math.abs(lhsStudent.b - c) < 1e-6) {
        return {
          isDistributiveError: true,
          detail: `При розкритті дужок у лівій частині (${refLhsRaw}) множник ${k} помножено на перший доданок у дужках, але другий доданок (${c > 0 ? `+ ${c}` : c}) залишився непомноженим: отримано "${lhsStudent.formatted}" замість "${lhsExpected.formatted}".`,
        };
      }
    }

    return {
      isDistributiveError: true,
      detail: `Помилка розкриття дужок у лівій частині: отримано "${lhsStudent.formatted}" замість очікуваного "${lhsExpected.formatted}".`,
    };
  }

  // Case 2: Any other bracket expansion mismatch when removing parentheses
  if (
    Math.abs(lhsStudent.b - lhsExpected.b) > 1e-6 ||
    Math.abs(rhsStudent.b - rhsExpected.b) > 1e-6
  ) {
    return {
      isDistributiveError: true,
      detail: `Неправильно застосовано розподільний закон множення при розкритті дужок: отримано "${lhsStudent.formatted} = ${rhsStudent.formatted}", тоді як після розкриття дужок має бути "${lhsExpected.formatted} = ${rhsExpected.formatted}".`,
    };
  }

  return { isDistributiveError: false };
}

/**
 * Computes the next canonical expected step from a reference equation
 */
export function computeCanonicalNextStep(
  referenceEq: string,
  lhsExpected: LinearPolynomial,
  rhsExpected: LinearPolynomial,
  targetRoot: number,
  variable = "x"
): string {
  if (/[()]/.test(referenceEq)) {
    return `${lhsExpected.formatted} = ${rhsExpected.formatted}`;
  }
  const netA = lhsExpected.a - rhsExpected.a;
  const netB = rhsExpected.b - lhsExpected.b;
  if (
    Math.abs(rhsExpected.a) > 1e-6 ||
    (Math.abs(lhsExpected.b) > 1e-6 && Math.abs(netA) > 1e-6)
  ) {
    const leftTerm = formatLinearPolynomial(netA, 0, variable);
    return `${leftTerm} = ${netB}`;
  }
  return `${variable} = ${targetRoot}`;
}

/**
 * Main deterministic Neuro-Symbolic verification entry point.
 * Evaluates a student's raw input against the current problem & last valid equation step.
 */
export function verifyStudentStep(
  rawStudentInput: string,
  referenceEquation: string,
  targetRoot: number,
  variable = "x"
): VerificationResult {
  const [refLhsStr, refRhsStr] = referenceEquation.split("=").map((s) => s.trim());
  const lhsExpected = evaluateToLinearPolynomial(refLhsStr, variable) ?? {
    a: 1,
    b: 0,
    formatted: refLhsStr,
  };
  const rhsExpected = evaluateToLinearPolynomial(refRhsStr, variable) ?? {
    a: 0,
    b: targetRoot,
    formatted: refRhsStr,
  };

  const expectedNextStep = computeCanonicalNextStep(
    referenceEquation,
    lhsExpected,
    rhsExpected,
    targetRoot,
    variable
  );

  const normalized = normalizeStudentInput(rawStudentInput, variable);

  if (!normalized.extractedEquation) {
    return {
      hasMathExpression: false,
      extractedEquation: null,
      normalizedLatex: normalized.normalizedLatex,
      isEquivalentToTarget: false,
      isFinalSolvedStep: false,
      isTrivialCopy: false,
      isValidProgressStep: false,
      studentRoot: null,
      targetRoot,
      lhsStudent: null,
      rhsStudent: null,
      lhsExpected,
      rhsExpected,
      errorCategory: "NONE",
      diagnosticSummary:
        normalized.classification === "SUB_STEP_VALUE"
          ? `Учень надав проміжне значення/вираз "${normalized.extractedSubExpression}" замість повного рівняння.`
          : "Повідомлення учня не містить рівняння зі знаком '=' (текстова відповідь або запитання).",
      expectedNextCanonicalStep: expectedNextStep,
    };
  }

  const [stuLhsStr, stuRhsStr] = normalized.extractedEquation
    .split("=")
    .map((s) => s.trim());

  const lhsStudent = evaluateToLinearPolynomial(stuLhsStr, variable);
  const rhsStudent = evaluateToLinearPolynomial(stuRhsStr, variable);

  if (!lhsStudent || !rhsStudent) {
    return {
      hasMathExpression: true,
      extractedEquation: normalized.extractedEquation,
      normalizedLatex: normalized.normalizedLatex,
      isEquivalentToTarget: false,
      isFinalSolvedStep: false,
      isTrivialCopy: false,
      isValidProgressStep: false,
      studentRoot: null,
      targetRoot,
      lhsStudent: null,
      rhsStudent: null,
      lhsExpected,
      rhsExpected,
      errorCategory: "INVALID_EXPRESSION",
      diagnosticSummary: `Не вдалося розпізнати алгебраїчний вираз "${normalized.extractedEquation}" як коректне лінійне рівняння.`,
      expectedNextCanonicalStep: expectedNextStep,
    };
  }

  const studentRoot = solveLinearRoot(lhsStudent, rhsStudent);
  const isEquivalent =
    studentRoot !== null && Math.abs(studentRoot - targetRoot) < 1e-6;

  // Check if student just copied the exact same string as referenceEquation
  const cleanStu = normalized.extractedEquation.replace(/\s+/g, "").toLowerCase();
  const cleanRef = referenceEquation.replace(/\s+/g, "").toLowerCase();
  const isTrivialCopy = cleanStu === cleanRef;

  // Check if it is the final solved form: x = targetRoot or targetRoot = x
  const isIsolatedLeft =
    Math.abs(lhsStudent.a - 1) < 1e-6 &&
    Math.abs(lhsStudent.b) < 1e-6 &&
    Math.abs(rhsStudent.a) < 1e-6 &&
    !/[()]/.test(stuLhsStr) &&
    !/[+\-*/]/.test(stuRhsStr.replace(/^-/, ""));

  const isIsolatedRight =
    Math.abs(rhsStudent.a - 1) < 1e-6 &&
    Math.abs(rhsStudent.b) < 1e-6 &&
    Math.abs(lhsStudent.a) < 1e-6 &&
    !/[()]/.test(stuRhsStr) &&
    !/[+\-*/]/.test(stuLhsStr.replace(/^-/, ""));

  const isFinalSolvedStep = isEquivalent && (isIsolatedLeft || isIsolatedRight);

  if (isEquivalent) {
    return {
      hasMathExpression: true,
      extractedEquation: normalized.extractedEquation,
      normalizedLatex: normalized.normalizedLatex,
      isEquivalentToTarget: true,
      isFinalSolvedStep,
      isTrivialCopy,
      isValidProgressStep: !isTrivialCopy,
      studentRoot,
      targetRoot,
      lhsStudent,
      rhsStudent,
      lhsExpected,
      rhsExpected,
      errorCategory: "NONE",
      diagnosticSummary: isFinalSolvedStep
        ? `Учень правильно знайшов фінальний корінь рівняння: ${variable} = ${targetRoot}.`
        : `Крок "${normalized.extractedEquation}" математично еквівалентний початковому рівнянню (корінь ${variable} = ${targetRoot} збережено).`,
      expectedNextCanonicalStep: isFinalSolvedStep
        ? `${variable} = ${targetRoot}`
        : computeCanonicalNextStep(
            normalized.extractedEquation,
            lhsStudent,
            rhsStudent,
            targetRoot,
            variable
          ),
    };
  }

  // Equation is NOT equivalent -> Deterministically classify the exact algebraic misconception!
  let errorCategory: ErrorCategory = "ARITHMETIC_OR_ALGEBRAIC";
  let specificDiscrepancy = `Рівняння учня "${normalized.extractedEquation}" має корінь ${variable} = ${studentRoot ?? "∅"}, що не збігається з правильним коренем ${variable} = ${targetRoot}.`;

  // 1. Check Distributive Property (bracket expansion error)
  const bracketCheck = inspectBracketDiscrepancy(
    referenceEquation,
    lhsExpected,
    rhsExpected,
    lhsStudent,
    rhsStudent
  );
  if (bracketCheck.isDistributiveError) {
    errorCategory = "DISTRIBUTIVE_PROPERTY";
    specificDiscrepancy = bracketCheck.detail ?? specificDiscrepancy;
  } else {
    // 2. Check Sign Flip / Transposition error across '='
    const expectedNetA = Math.abs(lhsExpected.a - rhsExpected.a);
    const wrongSignNetA = Math.abs(lhsExpected.a + rhsExpected.a);
    const studentNetA = Math.abs(lhsStudent.a - rhsStudent.a);

    const expectedNetB = Math.abs(rhsExpected.b - lhsExpected.b);
    const wrongSignNetB = Math.abs(rhsExpected.b + lhsExpected.b);
    const studentNetB = Math.abs(rhsStudent.b - lhsStudent.b);

    if (
      (Math.abs(rhsExpected.a) > 1e-6 &&
        Math.abs(studentNetA - wrongSignNetA) < 1e-6 &&
        Math.abs(expectedNetA - wrongSignNetA) > 1e-6) ||
      (Math.abs(lhsExpected.b) > 1e-6 &&
        Math.abs(studentNetB - wrongSignNetB) < 1e-6 &&
        Math.abs(expectedNetB - wrongSignNetB) > 1e-6)
    ) {
      errorCategory = "SIGN_FLIP_OR_TRANSPOSITION";
      specificDiscrepancy = `Помилка знаку при перенесенні доданків через знак '=': учень отримав "${normalized.extractedEquation}", не змінивши знак перенесеного доданка на протилежний (очікувалось зведення до "${expectedNextStep}").`;
    } else if (
      // 3. Check final division/isolation error (e.g. student wrote x = wrong_number)
      (Math.abs(lhsStudent.a - 1) < 1e-6 &&
        Math.abs(lhsStudent.b) < 1e-6 &&
        Math.abs(rhsStudent.a) < 1e-6) ||
      (Math.abs(rhsStudent.a - 1) < 1e-6 &&
        Math.abs(rhsStudent.b) < 1e-6 &&
        Math.abs(lhsStudent.a) < 1e-6)
    ) {
      errorCategory = "DIVISION_OR_ISOLATION";
      specificDiscrepancy = `Неправильно обчислено кінцеве значення ${variable}: отримано ${variable} = ${studentRoot}, тоді як правильний корінь попереднього кроку дає інший результат.`;
    } else {
      // 4. Combining like terms / arithmetic slip
      errorCategory = "COMBINE_LIKE_TERMS";
      specificDiscrepancy = `Арифметична помилка при зведенні подібних доданків: учень записав "${normalized.extractedEquation}" (еквівалентно ${lhsStudent.formatted} = ${rhsStudent.formatted}), але правильне спрощення має зберігати рівність ${lhsExpected.formatted} = ${rhsExpected.formatted}.`;
    }
  }

  return {
    hasMathExpression: true,
    extractedEquation: normalized.extractedEquation,
    normalizedLatex: normalized.normalizedLatex,
    isEquivalentToTarget: false,
    isFinalSolvedStep: false,
    isTrivialCopy: false,
    isValidProgressStep: false,
    studentRoot,
    targetRoot,
    lhsStudent,
    rhsStudent,
    lhsExpected,
    rhsExpected,
    errorCategory,
    diagnosticSummary: specificDiscrepancy,
    specificDiscrepancy,
    expectedNextCanonicalStep: expectedNextStep,
  };
}
