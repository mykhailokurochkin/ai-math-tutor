import type { InputClassification } from "../types";

export interface NormalizedStudentInput {
  raw: string;
  classification: InputClassification;
  /** Extracted full equation e.g. "3x + 4 = 2x + 19" or "x = 7" */
  extractedEquation: string | null;
  /** Extracted standalone expression or numeric answer to a sub-question e.g. "12" or "3x + 12" */
  extractedSubExpression: string | null;
  /** Clean LaTeX string for KaTeX and CortexJS */
  normalizedLatex: string | null;
}

const GIVE_UP_PATTERNS = [
  /просто\s+скажи/i,
  /скажи\s+відповідь/i,
  /яка\s+відповідь/i,
  /дай\s+відповідь/i,
  /дай\s+розв'?язок/i,
  /розв'?яжи\s+за\s+мене/i,
  /здаюсь/i,
  /здаюся/i,
  /не\s+знаю.*скажи/i,
  /just\s+(tell|give)\s+me\s+the\s+(answer|solution)/i,
  /what\s+is\s+the\s+answer/i,
  /i\s+give\s+up/i,
  /ignore\s+previous\s+instructions/i,
  /забудь\s+інструкції/i,
];

const WORKED_EXAMPLE_PATTERNS = [
  /покажи\s+розбір/i,
  /поясни\s+розв'?язок/i,
  /покроковий\s+розбір/i,
  /show\s+worked\s+example/i,
  /explain\s+the\s+step/i,
];

const HINT_PATTERNS = [
  /^підкажи$/i,
  /^підказка$/i,
  /дай\s+підказку/i,
  /що\s+робити\s+далі/i,
  /як\s+розкрити\s+дужки/i,
  /не\s+розумію\s+що\s+далі/i,
  /\bhint\b/i,
  /\bhelp\b/i,
  /i'?m\s+stuck/i,
  /what\s+(do|should)\s+i\s+do/i,
  /how\s+do\s+i\s+(start|solve|expand)/i,
];

/**
 * Normalizes typography signs (unicode minus, multiplication dots, Cyrillic х -> Latin x)
 */
export function sanitizeMathCharacters(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    // Replace Cyrillic 'х'/'Х' when used as variable x near numbers/operators/equals
    .replace(/(^|[\d\s(+*\-/=])[хХ](?=[\d\s)+\-*/=]|$)/g, "$1x");
}

/**
 * Extracts an equation containing '=' from a potentially conversational message.
 * Example: "Я розкрив дужки і вийшло 3x + 4 = 2x + 19" -> "3x + 4 = 2x + 19"
 */
export function extractEquationFromText(rawText: string): string | null {
  const cleaned = sanitizeMathCharacters(rawText)
    .replace(/\$/g, " ")
    .trim();

  if (!cleaned.includes("=")) {
    return null;
  }

  // Match contiguous mathematical equation segments around '='
  const eqRegex =
    /([+-]?\s*(?:[\d.]+|[a-zA-Z])\s*(?:[\d.a-zA-Z()+\-*/^\s]*[\d.a-zA-Z)])?\s*=\s*[+-]?\s*(?:[\d.]+|[a-zA-Z()])[\d.a-zA-Z()+\-*/^\s]*)/;
  const match = cleaned.match(eqRegex);
  if (!match || !match[1]) {
    return null;
  }

  const candidate = match[1]
    .replace(/\s+/g, " ")
    .replace(/[.,;!?]+$/, "")
    .trim();

  const parts = candidate.split("=");
  if (parts.length !== 2) return null;

  const lhs = parts[0].trim();
  const rhs = parts[1].trim();
  if (!lhs || !rhs) return null;

  return `${lhs} = ${rhs}`;
}

/**
 * Converts clean ASCII equation/expression into clean LaTeX string
 */
export function asciiToLatex(expr: string): string {
  return sanitizeMathCharacters(expr)
    .replace(/\*/g, " \\cdot ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analyzes raw student message and classifies intent + extracts math
 */
export function normalizeStudentInput(
  rawMessage: string,
  variable = "x"
): NormalizedStudentInput {
  const trimmed = rawMessage.trim();

  if (WORKED_EXAMPLE_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      raw: rawMessage,
      classification: "WORKED_EXAMPLE_REQUEST",
      extractedEquation: null,
      extractedSubExpression: null,
      normalizedLatex: null,
    };
  }

  if (GIVE_UP_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      raw: rawMessage,
      classification: "GIVE_UP_REQUEST",
      extractedEquation: null,
      extractedSubExpression: null,
      normalizedLatex: null,
    };
  }

  // Try extracting an equation with '='
  const extractedEq = extractEquationFromText(trimmed);
  if (extractedEq) {
    return {
      raw: rawMessage,
      classification: "MATH_STEP",
      extractedEquation: extractedEq,
      extractedSubExpression: null,
      normalizedLatex: asciiToLatex(extractedEq),
    };
  }

  if (HINT_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      raw: rawMessage,
      classification: "HINT_REQUEST",
      extractedEquation: null,
      extractedSubExpression: null,
      normalizedLatex: null,
    };
  }

  // Check if the student provided a standalone math expression or number (e.g., "3x + 12" or "12")
  const sanitized = sanitizeMathCharacters(trimmed).replace(/[?.!]+$/, "").trim();
  const pureMathExprRegex = new RegExp(
    `^[+-]?[\\d\\s()+\\-*/.${variable}]+$`,
    "i"
  );
  if (sanitized.length > 0 && pureMathExprRegex.test(sanitized) && /[\dx]/i.test(sanitized)) {
    return {
      raw: rawMessage,
      classification: "SUB_STEP_VALUE",
      extractedEquation: null,
      extractedSubExpression: sanitized,
      normalizedLatex: asciiToLatex(sanitized),
    };
  }

  return {
    raw: rawMessage,
    classification: "CONCEPTUAL_REPLY",
    extractedEquation: null,
    extractedSubExpression: null,
    normalizedLatex: null,
  };
}
