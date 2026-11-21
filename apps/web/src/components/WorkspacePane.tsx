"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
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
  onSubmitStep,
}: {
  currentProblem: MathProblem;
  availableProblems: MathProblem[];
  fsmState: FSMState;
  notebookSteps: NotebookStepRecord[];
  isSubmitting: boolean;
  onSelectProblem: (problemId: string) => void;
  onResetSession: () => void;
  onSubmitStep: (stepExpr: string) => void;
}) {
  const [stepInput, setStepInput] = useState("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepInput.trim() || isSubmitting) return;
    onSubmitStep(stepInput.trim());
    setStepInput("");
  };

  return (
    <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex flex-col h-full overflow-hidden">
      {/* Top Workspace Header */}
      <div className="px-6 py-4 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#FBFBFD]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
            <BookMarked className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-medium text-[#6E6E73] block">
              Step-by-Step Math Workspace
            </span>
            <select
              value={currentProblem.id}
              onChange={(e) => onSelectProblem(e.target.value)}
              disabled={isSubmitting}
              className="text-sm font-semibold text-[#1D1D1F] bg-transparent focus:outline-none cursor-pointer pr-2"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] transition-colors cursor-pointer"
          title="Reset current exercise"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Hero Active Problem Statement Card */}
      <div className="px-6 py-5 border-b border-black/[0.06] bg-gradient-to-b from-[#FBFBFD] to-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
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

        <div className="py-4 px-5 rounded-2xl bg-[#F5F5F7]/70 border border-black/[0.05] flex items-center justify-center">
          <div className="text-2xl sm:text-3xl text-[#1D1D1F]">
            <MathFormula latex={currentProblem.latex} displayMode />
          </div>
        </div>
      </div>

      {/* Notebook Steps Grid Surface */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3 bg-[radial-gradient(#00000010_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="flex items-center justify-between text-xs font-medium text-[#6E6E73] mb-1">
          <span>Student Solution Steps</span>
          <span>{notebookSteps.length} steps</span>
        </div>

        {notebookSteps.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-black/[0.12] bg-white/80 text-center space-y-2">
            <p className="text-sm font-medium text-[#1D1D1F]">
              No steps submitted yet
            </p>
            <p className="text-xs text-[#6E6E73] max-w-sm mx-auto leading-relaxed">
              Enter your first algebraic step below to solve{" "}
              <MathFormula latex={currentProblem.latex} /> (or click{" "}
              <strong>Run Test Scenario</strong> above to simulate{" "}
              <code className="px-1 py-0.5 bg-black/[0.05] rounded">
                3x + 4 = 2x + 19
              </code>
              ).
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
                        className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
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

                    <div>
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

      {/* Bottom Step Input Form */}
      <form
        onSubmit={handleFormSubmit}
        className="p-4 border-t border-black/[0.06] bg-[#FBFBFD]"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={stepInput}
            onChange={(e) => setStepInput(e.target.value)}
            placeholder="Write your next algebraic step (e.g. 3x + 12 = 2x + 19)..."
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.1] text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] font-mono transition-all"
          />
          <button
            type="submit"
            disabled={!stepInput.trim() || isSubmitting}
            className="px-4 py-2.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <span>Submit Step</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {fsmState.phase === "MASTERED" && (
          <div className="mt-2 text-xs font-semibold text-[#1D9E5E] px-1">
            ✓ Concept verified and mastered
          </div>
        )}
      </form>
    </div>
  );
}
