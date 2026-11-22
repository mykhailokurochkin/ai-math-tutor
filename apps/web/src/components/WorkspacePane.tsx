"use client";

import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  BookMarked,
} from "lucide-react";
import { MathFormula } from "./MathRenderer";
import type { MathProblem, FSMState } from "@ai-math-tutor/tutor-harness";
import type { NotebookStepRecord } from "@/lib/store";

export function WorkspacePane({
  currentProblem,
  availableProblems,
  fsmState,
  notebookSteps,
  isSubmitting,
  onSelectProblem,
  onResetSession,
}: {
  currentProblem: MathProblem;
  availableProblems: MathProblem[];
  fsmState: FSMState;
  notebookSteps: NotebookStepRecord[];
  isSubmitting: boolean;
  onSelectProblem: (problemId: string) => void;
  onResetSession: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex flex-col h-full min-h-0 overflow-hidden">
      {/* Top Workspace Header */}
      <div className="px-6 py-3.5 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#FBFBFD] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
            <BookMarked className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-[#6E6E73] block">
              Step-by-Step Solution Board
            </span>
            <select
              value={currentProblem.id}
              onChange={(e) => onSelectProblem(e.target.value)}
              disabled={isSubmitting}
              className="text-sm font-semibold text-[#1D1D1F] bg-transparent focus:outline-none cursor-pointer pr-2 truncate max-w-full"
            >
              {availableProblems.map((prob) => (
                <option key={prob.id} value={prob.id}>
                  {prob.isReinforcement ? "🔁 [Follow-Up] " : ""}
                  {prob.equation} — {prob.topicTitle}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onResetSession}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] transition-colors cursor-pointer shrink-0"
          title="Reset current exercise"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Hero Active Problem Statement Card */}
      <div className="px-6 py-4 border-b border-black/[0.06] bg-gradient-to-b from-[#FBFBFD] to-white shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/[0.05] text-[#6E6E73]">
            {currentProblem.gradeLevel}
          </span>
          {currentProblem.isReinforcement ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
              <Sparkles className="w-3 h-3" />
              Personalized Follow-Up Problem
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#6E6E73]">
              {currentProblem.topicTitle}
            </span>
          )}
        </div>

        <div className="py-3.5 px-5 rounded-2xl bg-[#F5F5F7]/70 border border-black/[0.05] flex items-center justify-center">
          <div className="text-2xl sm:text-3xl text-[#1D1D1F]">
            <MathFormula latex={currentProblem.latex} displayMode />
          </div>
        </div>
      </div>

      {/* Notebook Steps Grid Surface (Strictly Scrollable Internally) */}
      <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-3 bg-[radial-gradient(#00000010_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="flex items-center justify-between text-xs font-medium text-[#6E6E73] mb-1">
          <span>Recorded Algebraic Steps</span>
          <div className="flex items-center gap-3">
            {fsmState.phase === "MASTERED" && (
              <span className="text-xs font-semibold text-[#1D9E5E]">
                ✓ Concept Mastered
              </span>
            )}
            <span>{notebookSteps.length} steps</span>
          </div>
        </div>

        {notebookSteps.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-black/[0.12] bg-white/80 text-center space-y-2">
            <p className="text-sm font-medium text-[#1D1D1F]">
              No algebraic steps recorded yet
            </p>
            <p className="text-xs text-[#6E6E73] max-w-sm mx-auto leading-relaxed">
              Send your equation steps in the <strong>AI Math Tutor</strong> chat on the right — every mathematical step you write is automatically parsed, verified, and displayed here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notebookSteps.map((step) => {
              const isError = step.status === "ERROR_DETECTED";
              const isFinal = step.status === "CORRECT_FINAL";
              const isWorked = step.status === "WORKED_EXAMPLE";

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isError
                      ? "bg-[#FEF3F2]/90 border-[#D92D20]/25"
                      : isFinal
                        ? "bg-[#ECFDF3]/90 border-[#1D9E5E]/30"
                        : isWorked
                          ? "bg-[#FFFBEB]/90 border-[#D97706]/30"
                          : "bg-white/95 border-black/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                          isError
                            ? "bg-[#D92D20] text-white"
                            : isFinal
                              ? "bg-[#1D9E5E] text-white"
                              : isWorked
                                ? "bg-[#D97706] text-white"
                                : "bg-[#0071E3]/10 text-[#0071E3]"
                        }`}
                      >
                        {step.stepNumber}
                      </span>
                      <div className="text-base sm:text-lg font-medium text-[#1D1D1F]">
                        <MathFormula latex={step.expressionLatex} />
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isError && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D92D20]/10 text-[#D92D20]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Reasoning Error
                        </span>
                      )}
                      {step.status === "CORRECT_INTERMEDIATE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF3] text-[#1D9E5E]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Valid Step
                        </span>
                      )}
                      {isFinal && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1D9E5E] text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Solved
                        </span>
                      )}
                      {isWorked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D97706]/15 text-[#D97706]">
                          Worked Explanation
                        </span>
                      )}
                    </div>
                  </div>

                  {isError && (
                    <p className="mt-2 text-xs text-[#B42318] pl-9 leading-relaxed">
                      {step.diagnosticNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
