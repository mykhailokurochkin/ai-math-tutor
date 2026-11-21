import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type {
  CurriculumRule,
  ErrorCategory,
  FSMState,
  InputClassification,
  MathProblem,
  VerificationResult,
} from "../types";
import { PEDAGOGY_DIRECTIVES_MD } from "../config/pedagogyConfig";
import { buildSafeSocraticFallback } from "../guardrails/leakageGate";

export interface PromptContext {
  problem: MathProblem;
  studentMessage: string;
  classification: InputClassification;
  verification: VerificationResult;
  nextFsmState: FSMState;
  curriculumRule: CurriculumRule | null;
  forbiddenReveals: string[];
  pedagogicalDirective: string;
  followUpProblem?: MathProblem;
  conversationHistory?: Array<{ role: "student" | "tutor"; content: string }>;
}

export function resolveActiveProviderInfo(): {
  provider: "google" | "openai" | "anthropic" | "neuro-symbolic-guided";
  modelName: string;
} {
  const envProvider = (process.env.LLM_PROVIDER ?? "").toLowerCase();

  if (
    (envProvider === "google" || !envProvider) &&
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      provider: "google",
      modelName: process.env.LLM_MODEL || "gemini-2.5-flash",
    };
  }

  if (
    (envProvider === "openai" || !envProvider) &&
    process.env.OPENAI_API_KEY
  ) {
    return {
      provider: "openai",
      modelName: process.env.LLM_MODEL || "gpt-4o-mini",
    };
  }

  if (
    (envProvider === "anthropic" || !envProvider) &&
    process.env.ANTHROPIC_API_KEY
  ) {
    return {
      provider: "anthropic",
      modelName: process.env.LLM_MODEL || "claude-3-5-haiku-latest",
    };
  }

  return {
    provider: "neuro-symbolic-guided",
    modelName: "symbolic-pedagogical-engine-v1",
  };
}

/**
 * Deterministic Neuro-Symbolic Guided Response Synthesizer.
 * Used when no external LLM API key is configured (or as instant zero-latency fallback).
 */
export function synthesizeGuidedResponse(ctx: PromptContext): string {
  const {
    problem,
    studentMessage,
    classification,
    verification,
    nextFsmState,
    curriculumRule,
    followUpProblem,
  } = ctx;

  // 1. WORKED_EXAMPLE phase (after 3 failed attempts or explicit request after trying)
  if (nextFsmState.phase === "WORKED_EXAMPLE") {
    const expectedNext =
      verification.expectedNextCanonicalStep ??
      `${verification.lhsExpected.formatted} = ${verification.rhsExpected.formatted}`;
    const ruleExplanation = curriculumRule
      ? `За правилом **«${curriculumRule.titleUk}»** ($${curriculumRule.formulaLatex}$): ${curriculumRule.ussrMethodologyNote}`
      : `Розкриємо дужки та зведемо подібні доданки в обох частинах рівняння.`;

    const followUpNotice = followUpProblem
      ? `\n\nОскільки ми розібрали цей крок разом, давай одразу закріпимо тему на аналогічному рівнянні: **$${followUpProblem.equation}$**. Спробуй розкрити дужки в ньому самостійно!`
      : "";

    return `Бачу, цей крок викликав труднощі — давай розберемо його детально!\n\nУ рівнянні **$${nextFsmState.lastValidEquation}$**:\n${ruleExplanation}\n\nОтже, правильний наступний крок виглядає так:\n$$${expectedNext}$$\nЗвідси після перенесення доданків отримуємо кінцевий корінь **$${problem.variable} = ${problem.expectedRoot}$**.${followUpNotice}`;
  }

  // 2. REINFORCEMENT transition (student just solved the problem after making an earlier mistake!)
  if (
    nextFsmState.phase === "REINFORCEMENT" &&
    verification.isFinalSolvedStep &&
    followUpProblem
  ) {
    return `Чудово! Ти виправив помилку і знайшов абсолютно правильний корінь **$${problem.variable} = ${problem.expectedRoot}$**! 🎉\n\nЗа класичною методикою, щоб тема вважалася повністю засвоєною після виправлення помилки, розв'яжи схоже рівняння на це саме правило:\n$$${followUpProblem.equation}$$\nЯким буде перший крок після розкриття дужок?`;
  }

  // 3. MASTERED phase (student solved cleanly or finished the reinforcement problem!)
  if (nextFsmState.phase === "MASTERED") {
    if (problem.isReinforcement) {
      return `Браво! **$${problem.variable} = ${problem.expectedRoot}$** — абсолютно правильно! 🏆\nТи самостійно розв'язав задачу на закріплення і довів, що тему **«${problem.topicTitle.replace(" (Закріплення)", "")}»** засвоєно на 100%!`;
    }
    return `Відмінно! **$${problem.variable} = ${problem.expectedRoot}$** — бездоганний розв'язок з першої спроби! 🏆 Тему зараховано до твого прогресу.`;
  }

  // 4. Student entered a valid intermediate step (e.g., 3x + 12 = 2x + 19 or x + 12 = 19)
  if (verification.hasMathExpression && verification.isEquivalentToTarget) {
    if (verification.isTrivialCopy) {
      return `Це початкова умова рівняння **$${problem.equation}$**. Яку дію виконаємо першою, щоб спростити його?`;
    }
    return `Правильний крок! Рівняння **$${verification.extractedEquation}$** записано бездоганно. Що зробимо далі, щоб зібрати доданки з $${problem.variable}$ в одній частині, а числа — в іншій?`;
  }

  // 5. Student asked to give up ("просто скажи відповідь") on attempts 1..3
  if (classification === "GIVE_UP_REQUEST") {
    const socraticHint = buildSafeSocraticFallback(
      problem,
      verification,
      nextFsmState.hintLevel || 1,
      nextFsmState.activeErrorCategory
    );
    return `Я розумію, що хочеться одразу дізнатися відповідь, але справжній математик знаходить її сам! Давай я підкажу наступний крок (Підказка ${nextFsmState.hintLevel}/3).\n\n${socraticHint}`;
  }

  // 6. Student replied with a sub-step value or conceptual message during Socratic guidance (e.g., "12" or "треба помножити 3 на 4")
  if (!verification.hasMathExpression) {
    const expectedB = Math.abs(verification.lhsExpected.b);
    if (
      studentMessage.includes(String(expectedB)) &&
      nextFsmState.activeErrorCategory === "DISTRIBUTIVE_PROPERTY"
    ) {
      return `Точно! Добуток дорівнює **$${expectedB}$**. Тепер підстав це число в ліву частину і запиши повне виправлене рівняння зі знаком \`=\`.`;
    }

    return buildSafeSocraticFallback(
      problem,
      verification,
      nextFsmState.hintLevel || 1,
      nextFsmState.activeErrorCategory
    );
  }

  // 7. Student made an algebraic mistake -> Socratic Guidance (L1 / L2 / L3)
  return buildSafeSocraticFallback(
    problem,
    verification,
    nextFsmState.hintLevel || 1,
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : nextFsmState.activeErrorCategory
  );
}

/**
 * Generates tutor response using configured LLM via Vercel AI SDK,
 * with automatic fallback to deterministic Neuro-Symbolic Guided Engine.
 */
export async function generateTutorResponse(
  ctx: PromptContext
): Promise<{ text: string; providerLabel: string }> {
  const providerInfo = resolveActiveProviderInfo();

  if (providerInfo.provider === "neuro-symbolic-guided") {
    return {
      text: synthesizeGuidedResponse(ctx),
      providerLabel: `${providerInfo.provider} (${providerInfo.modelName})`,
    };
  }

  const systemPrompt = `${PEDAGOGY_DIRECTIVES_MD}

<CURRENT_LESSON_CONTEXT>
Problem Equation: ${ctx.problem.equation}
Grade / Topic: ${ctx.problem.gradeLevel} — ${ctx.problem.topicTitle}
Current Pedagogical Phase: ${ctx.nextFsmState.phase}
Current Hint Level: ${ctx.nextFsmState.hintLevel} (1 = Conceptual question, 2 = Focused term check, 3 = Atomic micro-step)
Failed Attempts on Current Step: ${ctx.nextFsmState.failedAttemptsOnCurrentStep}
</CURRENT_LESSON_CONTEXT>

<HIDDEN_SYMBOLIC_SCRATCHPAD>
Last Valid Step: ${ctx.nextFsmState.lastValidEquation}
Student Raw Input: ${ctx.studentMessage}
Input Classification: ${ctx.classification}
Extracted Student Equation: ${ctx.verification.extractedEquation ?? "none"}
Is Algebraically Equivalent: ${ctx.verification.isEquivalentToTarget}
Is Final Solved Root: ${ctx.verification.isFinalSolvedStep}
Detected Error Category: ${ctx.verification.errorCategory}
CAS Diagnostic Summary: ${ctx.verification.diagnosticSummary}
Expected LHS Expanded: ${ctx.verification.lhsExpected.formatted}
Expected RHS Expanded: ${ctx.verification.rhsExpected.formatted}
Student LHS Expanded: ${ctx.verification.lhsStudent?.formatted ?? "N/A"}
Student RHS Expanded: ${ctx.verification.rhsStudent?.formatted ?? "N/A"}
Target Root (HIDDEN FROM STUDENT unless WORKED_EXAMPLE/MASTERED): ${ctx.problem.variable} = ${ctx.problem.expectedRoot}
${ctx.curriculumRule ? `USSR Curriculum Rule: ${ctx.curriculumRule.titleUk} ($${ctx.curriculumRule.formulaLatex}$) — ${ctx.curriculumRule.ussrMethodologyNote}` : ""}
${ctx.followUpProblem ? `Generated Isomorphic Follow-Up Problem to present NOW: ${ctx.followUpProblem.equation}` : ""}
</HIDDEN_SYMBOLIC_SCRATCHPAD>

<STRICT_GUARDRAIL_DIRECTIVE>
${ctx.pedagogicalDirective}
${ctx.forbiddenReveals.length > 0 ? `FORBIDDEN STRINGS (DO NOT OUTPUT THESE): ${JSON.stringify(ctx.forbiddenReveals)}` : ""}
</STRICT_GUARDRAIL_DIRECTIVE>`;

  const messages = [
    ...(ctx.conversationHistory ?? []).slice(-6).map((m) => ({
      role: (m.role === "student" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: ctx.studentMessage,
    },
  ];

  try {
    let model;
    if (providerInfo.provider === "google") {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      model = google(providerInfo.modelName);
    } else if (providerInfo.provider === "openai") {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      model = openai(providerInfo.modelName);
    } else {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      model = anthropic(providerInfo.modelName);
    }

    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.3,
      maxTokens: 350,
    });

    return {
      text: result.text.trim() || synthesizeGuidedResponse(ctx),
      providerLabel: `${providerInfo.provider}:${providerInfo.modelName}`,
    };
  } catch {
    return {
      text: synthesizeGuidedResponse(ctx),
      providerLabel: `neuro-symbolic-fallback (after ${providerInfo.provider} error)`,
    };
  }
}
