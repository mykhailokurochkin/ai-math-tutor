import { ComputeEngine } from "@cortex-js/compute-engine";
import type {
  ErrorCategory,
  LinearPolynomial,
  VerificationResult,
} from "../types";
import { asciiToLatex, normalizeStudentInput, sanitizeMathCharacters } from "./normalizer";

const ce = new ComputeEngine();

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

export function evaluateToLinearPolynomial(
  rawExpr: string,
  variable = "x"
): LinearPolynomial | null {
  try {
    const sanitized = sanitizeMathCharacters(rawExpr)
      .replace(/\s+/g, "")
      .replace(new RegExp(`(\\d)(${variable})`, "gi"), "$1*$2")
      .replace(/(\d)\(/g, "$1*(")
      .replace(/\)\(/g, ")*(")
      .replace(new RegExp(`\\)(${variable}|\\d)`, "gi"), ")*$1")
      .replace(new RegExp(`(${variable})\\(`, "gi"), "$1*(");

    const safePattern = new RegExp(`^[0-9+\\-*/().${variable}]+$`, "i");
    if (!sanitized || !safePattern.test(sanitized)) {
      return null;
    }

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

  const rhsMatches =
    Math.abs(rhsStudent.a - rhsExpected.a) < 1e-6 &&
    Math.abs(rhsStudent.b - rhsExpected.b) < 1e-6;

  if (
    rhsMatches &&
    Math.abs(lhsStudent.a - lhsExpected.a) < 1e-6 &&
    Math.abs(lhsStudent.b - lhsExpected.b) > 1e-6
  ) {
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
          detail: `Distributive property error on the left side (${refLhsRaw}): factor ${k} was multiplied by the first term inside the brackets, but the second term (${c > 0 ? `+ ${c}` : c}) was not multiplied by ${k} — resulting in "${lhsStudent.formatted}" instead of "${lhsExpected.formatted}".`,
        };
      }
    }

    return {
      isDistributiveError: true,
      detail: `Bracket expansion error on the left side: wrote "${lhsStudent.formatted}" instead of "${lhsExpected.formatted}".`,
    };
  }

  if (
    Math.abs(lhsStudent.b - lhsExpected.b) > 1e-6 ||
    Math.abs(rhsStudent.b - rhsExpected.b) > 1e-6
  ) {
    return {
      isDistributiveError: true,
      detail: `Incorrect application of the distributive property when expanding parentheses: wrote "${lhsStudent.formatted} = ${rhsStudent.formatted}" instead of "${lhsExpected.formatted} = ${rhsExpected.formatted}".`,
    };
  }

  return { isDistributiveError: false };
}

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
          ? `Student provided an intermediate value/expression "${normalized.extractedSubExpression}" instead of a full equation.`
          : "Student message does not contain an equation with '=' (conversational reply or question).",
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
      diagnosticSummary: `Could not parse "${normalized.extractedEquation}" as a valid linear equation.`,
      expectedNextCanonicalStep: expectedNextStep,
    };
  }

  const studentRoot = solveLinearRoot(lhsStudent, rhsStudent);
  const isEquivalent =
    studentRoot !== null && Math.abs(studentRoot - targetRoot) < 1e-6;

  const cleanStu = normalized.extractedEquation.replace(/\s+/g, "").toLowerCase();
  const cleanRef = referenceEquation.replace(/\s+/g, "").toLowerCase();
  const isTrivialCopy = cleanStu === cleanRef;

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
        ? `Student correctly found the final root: ${variable} = ${targetRoot}.`
        : `Step "${normalized.extractedEquation}" is algebraically equivalent to the target equation (root ${variable} = ${targetRoot} preserved).`,
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

  let errorCategory: ErrorCategory = "ARITHMETIC_OR_ALGEBRAIC";
  let specificDiscrepancy = `Student equation "${normalized.extractedEquation}" has root ${variable} = ${studentRoot ?? "∅"}, which does not match target root ${variable} = ${targetRoot}.`;

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
      specificDiscrepancy = `Sign error when transposing terms across '=': wrote "${normalized.extractedEquation}" without reversing the sign of the moved term (expected "${expectedNextStep}").`;
    } else if (
      (Math.abs(lhsStudent.a - 1) < 1e-6 &&
        Math.abs(lhsStudent.b) < 1e-6 &&
        Math.abs(rhsStudent.a) < 1e-6) ||
      (Math.abs(rhsStudent.a - 1) < 1e-6 &&
        Math.abs(rhsStudent.b) < 1e-6 &&
        Math.abs(lhsStudent.a) < 1e-6)
    ) {
      errorCategory = "DIVISION_OR_ISOLATION";
      specificDiscrepancy = `Incorrectly isolated final value for ${variable}: got ${variable} = ${studentRoot} instead of ${variable} = ${targetRoot}.`;
    } else {
      errorCategory = "COMBINE_LIKE_TERMS";
      specificDiscrepancy = `Arithmetic error while combining like terms: wrote "${normalized.extractedEquation}" (equivalent to ${lhsStudent.formatted} = ${rhsStudent.formatted}), breaking equality with ${lhsExpected.formatted} = ${rhsExpected.formatted}.`;
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
