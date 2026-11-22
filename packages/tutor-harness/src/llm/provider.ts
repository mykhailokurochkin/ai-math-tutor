import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type {
  CurriculumRule,
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
      modelName: process.env.LLM_MODEL || "gemini-3.5-flash-lite",
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

  if (nextFsmState.phase === "WORKED_EXAMPLE") {
    const expectedNext =
      verification.expectedNextCanonicalStep ??
      `${verification.lhsExpected.formatted} = ${verification.rhsExpected.formatted}`;
    const ruleExplanation = curriculumRule
      ? `By the **${curriculumRule.titleEn}** ($${curriculumRule.formulaLatex}$): ${curriculumRule.ussrMethodologyNote}`
      : `Let's expand the parentheses and combine like terms on both sides of the equation.`;

    const followUpNotice = followUpProblem
      ? `\n\nSince we walked through this step together, let's verify your understanding on a similar follow-up problem: **$${followUpProblem.equation}$**. Try expanding the parentheses on your own!`
      : "";

    return `Let's walk through this step together so the concept is crystal clear.\n\nIn the equation **$${nextFsmState.lastValidEquation}$**:\n${ruleExplanation}\n\nTherefore, the corrected next step is:\n$$${expectedNext}$$\nIsolating the variable from here gives the solution **$${problem.variable} = ${problem.expectedRoot}$**.${followUpNotice}`;
  }

  if (
    nextFsmState.phase === "REINFORCEMENT" &&
    verification.isFinalSolvedStep &&
    followUpProblem
  ) {
    return `Excellent work! You corrected the mistake and found the exact solution **$${problem.variable} = ${problem.expectedRoot}$**! 🎉\n\nTo verify understanding after correcting an error, let's practice on a similar problem targeting the same property:\n$$${followUpProblem.equation}$$\nWhat is your first step after expanding the parentheses?`;
  }

  if (nextFsmState.phase === "MASTERED") {
    if (problem.isReinforcement) {
      return `Outstanding! **$${problem.variable} = ${problem.expectedRoot}$** is completely correct! 🏆\nYou solved the follow-up problem independently and proved full mastery of **${problem.topicTitle.replace(" (Follow-Up Practice)", "")}**.`;
    }
    return `Spot on! **$${problem.variable} = ${problem.expectedRoot}$** — a flawless solution on the first attempt! 🏆 Your progress has been recorded.`;
  }

  if (verification.hasMathExpression && verification.isEquivalentToTarget) {
    if (verification.isTrivialCopy) {
      return `That is the starting equation **$${problem.equation}$**. What operation should we perform first to simplify it?`;
    }
    return `Good step! **$${verification.extractedEquation}$** is algebraically equivalent. What is your next step to isolate $${problem.variable}$?`;
  }

  if (classification === "GIVE_UP_REQUEST") {
    const socraticHint = buildSafeSocraticFallback(
      problem,
      verification,
      nextFsmState.hintLevel || 1,
      nextFsmState.activeErrorCategory
    );
    return `I won't give away the final answer right away — working through the step yourself builds real mathematical intuition! Here is a guiding hint (Hint ${nextFsmState.hintLevel}/3):\n\n${socraticHint}`;
  }

  if (!verification.hasMathExpression) {
    const expectedB = Math.abs(verification.lhsExpected.b);
    if (
      studentMessage.includes(String(expectedB)) &&
      nextFsmState.activeErrorCategory === "DISTRIBUTIVE_PROPERTY"
    ) {
      return `Exactly right! That product equals **$${expectedB}$**. Now substitute that value into the left side and write out the complete corrected equation with \`=\`.`;
    }

    return buildSafeSocraticFallback(
      problem,
      verification,
      nextFsmState.hintLevel || 1,
      nextFsmState.activeErrorCategory
    );
  }

  return buildSafeSocraticFallback(
    problem,
    verification,
    nextFsmState.hintLevel || 1,
    verification.errorCategory !== "NONE"
      ? verification.errorCategory
      : nextFsmState.activeErrorCategory
  );
}

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
${ctx.curriculumRule ? `USSR Curriculum Rule: ${ctx.curriculumRule.titleEn} ($${ctx.curriculumRule.formulaLatex}$) — ${ctx.curriculumRule.ussrMethodologyNote}` : ""}
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
      abortSignal: AbortSignal.timeout(8000),
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
