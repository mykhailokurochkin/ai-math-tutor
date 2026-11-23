"use client";

import React from "react";
import {
  Cpu,
  ShieldCheck,
  ShieldAlert,
  GitBranch,
  BookOpen,
  Terminal,
  Clock,
} from "lucide-react";
import type { HarnessTrace, FSMState } from "@ai-math-tutor/tutor-harness";

export function HarnessInspector({
  traces,
  fsmState,
  llmStatus,
}: {
  traces: HarnessTrace[];
  fsmState: FSMState;
  llmStatus: { provider: string; modelName: string };
}) {
  const latest = traces[0];

  return (
    <section className="rounded-3xl bg-[#111114] text-[#F5F5F7] border border-white/10 shadow-xl overflow-hidden">
      {/* Top Bar */}
      <div className="px-5 py-3 bg-[#18181C] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse" />
          <Terminal className="w-4 h-4 text-[#0A84FF]" />
          <span className="text-xs font-semibold tracking-tight text-white">
            LangGraph Harness Inspector · Neuro-Symbolic StateGraph
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#BF5AF2]/15 text-[#BF5AF2]">
            @langchain/langgraph
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.07] text-[#A1A1A6]">
            LLM: {llmStatus.provider} ({llmStatus.modelName})
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#A1A1A6]">
          <span>
            FSM: <strong className="text-[#0A84FF]">{fsmState.phase}</strong>
          </span>
          <span>
            Hint: <strong className="text-white">L{fsmState.hintLevel}/3</strong>
          </span>
          {latest && (
            <span className="inline-flex items-center gap-1 text-[#30D158]">
              <Clock className="w-3 h-3" />
              {latest.latencyMs}ms
            </span>
          )}
        </div>
      </div>

      {latest?.langGraphNodesExecuted && (
        <div className="px-5 py-2 bg-[#141418] border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <span className="text-[#86868B] shrink-0 mr-1">Executed Graph Nodes:</span>
          {latest.langGraphNodesExecuted.map((node, idx) => (
            <React.Fragment key={`${node}-${idx}`}>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[#F5F5F7] shrink-0">
                {node}
              </span>
              {idx < latest.langGraphNodesExecuted!.length - 1 && (
                <span className="text-[#6E6E73] shrink-0">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {!latest ? (
        <div className="p-6 text-center text-xs text-[#A1A1A6]">
          Waiting for the first student step. Click{" "}
          <strong className="text-white">
            &ldquo;1. Run Test Scenario: 3(x + 4) = 2x + 19 → 3x + 4 = 2x + 19&rdquo;
          </strong>{" "}
          above or submit an equation step to inspect the Neuro-Symbolic execution trace.
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {/* Card 1: Symbolic CAS Verifier */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C21] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-[#A1A1A6] font-medium">
              <span className="inline-flex items-center gap-1.5 text-white">
                <Cpu className="w-3.5 h-3.5 text-[#0A84FF]" />
                1. Symbolic CAS Verifier
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  !latest.verification.hasMathExpression
                    ? "bg-white/[0.1] text-[#D1D1D6]"
                    : latest.verification.isEquivalentToTarget
                      ? "bg-[#30D158]/15 text-[#30D158]"
                      : "bg-[#FF453A]/15 text-[#FF453A]"
                }`}
              >
                {!latest.verification.hasMathExpression
                  ? "TEXT / DIALOGUE"
                  : latest.verification.isEquivalentToTarget
                    ? "EQUIVALENT"
                    : "MISMATCH"}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-[#D1D1D6]">
              <div>
                Input:{" "}
                <span className="text-white">
                  {latest.verification.extractedEquation ?? latest.inputRaw}
                </span>
              </div>
              <div>
                Roots: Target{" "}
                <span className="text-[#30D158]">
                  x={latest.verification.targetRoot}
                </span>{" "}
                vs Student{" "}
                <span
                  className={
                    latest.verification.isEquivalentToTarget
                      ? "text-[#30D158]"
                      : "text-[#FF453A]"
                  }
                >
                  x={latest.verification.studentRoot ?? "N/A"}
                </span>
              </div>
              <div>
                LHS Exp:{" "}
                <span className="text-[#30D158]">
                  {latest.verification.lhsExpected.formatted}
                </span>{" "}
                | Stu:{" "}
                <span className="text-[#FF9F0A]">
                  {latest.verification.lhsStudent?.formatted ?? "N/A"}
                </span>
              </div>
              <div className="pt-1">
                <span className="px-2 py-0.5 rounded bg-white/[0.08] text-[#FF9F0A]">
                  {latest.verification.errorCategory}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Pedagogical State Machine */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C21] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-[#A1A1A6] font-medium">
              <span className="inline-flex items-center gap-1.5 text-white">
                <GitBranch className="w-3.5 h-3.5 text-[#BF5AF2]" />
                2. Pedagogical FSM
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#BF5AF2]/15 text-[#BF5AF2]">
                Hint L{latest.fsmTransition.nextHintLevel}/3
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-[#D1D1D6]">
              <div>
                State:{" "}
                <span className="text-[#A1A1A6]">
                  {latest.fsmTransition.from}
                </span>{" "}
                →{" "}
                <span className="text-white font-semibold">
                  {latest.fsmTransition.to}
                </span>
              </div>
              <div>
                Step Attempts:{" "}
                <span className="text-white">
                  {latest.fsmTransition.failedAttemptsOnStep} / 3
                </span>
              </div>
              <p className="text-[11px] font-sans text-[#A1A1A6] leading-snug pt-0.5">
                {latest.fsmTransition.reason}
              </p>
            </div>
          </div>

          {/* Card 3: USSR Curriculum & Hidden Scratchpad */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C21] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-[#A1A1A6] font-medium">
              <span className="inline-flex items-center gap-1.5 text-white">
                <BookOpen className="w-3.5 h-3.5 text-[#FF9F0A]" />
                3. Curriculum & Practice Gen
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.08] text-[#D1D1D6]">
                {latest.inputClassification}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#D1D1D6]">
              <div className="font-medium text-white">
                {latest.curriculumLookup?.ruleTitle ?? "Algebraic Equivalence"}
              </div>
              {latest.generatedFollowUpProblem && (
                <div className="px-2 py-1 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] font-mono">
                  Generated Follow-Up:{" "}
                  {latest.generatedFollowUpProblem.equation} (x=
                  {latest.generatedFollowUpProblem.expectedRoot})
                </div>
              )}
              <div className="font-mono text-[10px] text-[#A1A1A6] truncate">
                Blocked Reveals:{" "}
                {latest.hiddenScratchpad.forbiddenReveals.length > 0
                  ? latest.hiddenScratchpad.forbiddenReveals
                      .slice(0, 3)
                      .join(", ")
                  : "None (Allowed)"}
              </div>
            </div>
          </div>

          {/* Card 4: SocraGate Output-Admission Guardrail */}
          <div className="p-3.5 rounded-2xl bg-[#1C1C21] border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-[#A1A1A6] font-medium">
              <span className="inline-flex items-center gap-1.5 text-white">
                {latest.guardrailCheck.intercepted ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FF9F0A]" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#30D158]" />
                )}
                4. Leakage Guardrail
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  latest.guardrailCheck.intercepted
                    ? "bg-[#FF9F0A]/15 text-[#FF9F0A]"
                    : "bg-[#30D158]/15 text-[#30D158]"
                }`}
              >
                {latest.guardrailCheck.actionTaken}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#A1A1A6]">
              <div>
                Leakage Screen:{" "}
                <span className="text-white font-mono">
                  {latest.guardrailCheck.checked
                    ? "ACTIVE (Socratic Lock)"
                    : "UNLOCKED (Worked/Mastered)"}
                </span>
              </div>
              <p className="leading-snug">
                {latest.guardrailCheck.intercepted
                  ? `Intercepted premature answer leak (${latest.guardrailCheck.leakedTokens.join(", ")}). Replaced with safe Socratic question.`
                  : "Tutor output verified: no premature solution leakage detected."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
