"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  BookMarked,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { MathFormula } from "./MathRenderer";
import type {
  MathProblem,
  FSMState,
  CurriculumTopicId,
} from "@ai-math-tutor/tutor-harness";
import type { NotebookStepRecord } from "@/lib/store";

const TOPIC_FILTERS: Array<{
  id: CurriculumTopicId | "all";
  label: string;
}> = [
  { id: "all", label: "All Topics" },
  { id: "topic-distributive", label: "Distributive Property" },
  { id: "topic-transposition", label: "Transposition & Signs" },
  { id: "topic-olympiad", label: "Multi-Bracket" },
];

export function WorkspacePane({
  currentProblem,
  availableProblems,
  problemStatusMap,
  fsmState,
  notebookSteps,
  isSubmitting,
  onSelectProblem,
  onGenerateMoreProblems,
  onSubmitCustomProblem,
  onResetSession,
}: {
  currentProblem: MathProblem;
  availableProblems: MathProblem[];
  problemStatusMap: Record<
    string,
    "NOT_STARTED" | "IN_PROGRESS" | "SOLVED" | "ASSISTED"
  >;
  fsmState: FSMState;
  notebookSteps: NotebookStepRecord[];
  isSubmitting: boolean;
  onSelectProblem: (problemId: string) => void;
  onGenerateMoreProblems: (topicFilter: CurriculumTopicId | "all") => Promise<void>;
  onSubmitCustomProblem: (customEquation: string) => void;
  onResetSession: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<CurriculumTopicId | "all">("all");
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [customEqInput, setCustomEqInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredProblems = availableProblems.filter((p) =>
    topicFilter === "all" ? true : p.topicId === topicFilter
  );

  const handleGenerateMoreClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGeneratingMore) return;
    setIsGeneratingMore(true);
    try {
      await onGenerateMoreProblems(topicFilter);
      // Smoothly scroll list down to reveal newly appended items without closing dropdown
      setTimeout(() => {
        if (listScrollRef.current) {
          listScrollRef.current.scrollTo({
            top: listScrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 60);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEqInput.trim()) return;
    onSubmitCustomProblem(customEqInput.trim());
    setCustomEqInput("");
    setDropdownOpen(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex flex-col h-full min-h-0 overflow-hidden">
      {/* Top Workspace Header with Custom Apple-Style Popover Dropdown */}
      <div className="px-6 py-3.5 border-b border-black/[0.06] flex items-center justify-between gap-3 bg-[#FBFBFD] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1" ref={dropdownRef}>
          <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
            <BookMarked className="w-4 h-4" />
          </div>

          <div className="relative min-w-0 flex-1">
            <span className="text-[11px] font-medium text-[#6E6E73] block">
              Current Exercise
            </span>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setDropdownOpen((v) => !v)}
              className="mt-0.5 inline-flex items-center gap-2 px-2.5 py-1 -ml-2.5 rounded-xl hover:bg-black/[0.04] transition-colors cursor-pointer max-w-full group"
            >
              {currentProblem.isReinforcement && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#0071E3]/10 text-[#0071E3] shrink-0">
                  Follow-Up
                </span>
              )}
              <span className="text-sm font-semibold text-[#1D1D1F] shrink-0">
                <MathFormula latex={currentProblem.latex} />
              </span>
              <span className="text-xs text-[#6E6E73] truncate hidden sm:inline">
                — {currentProblem.topicTitle}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#6E6E73] group-hover:text-[#1D1D1F] transition-transform duration-150 shrink-0 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Custom Apple Popover Menu — Stays Open on Topic Filter & Generate 4 More */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-[360px] sm:w-[460px] rounded-2xl bg-white/95 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.14)] border border-black/[0.08] p-2.5 z-40 space-y-2.5">
                {/* Static Topic Filter Pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      Topics ({filteredProblems.length} exercises)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {TOPIC_FILTERS.map((tf) => {
                      const active = topicFilter === tf.id;
                      return (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTopicFilter(tf.id);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                            active
                              ? "bg-[#1D1D1F] text-white"
                              : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                          }`}
                        >
                          {tf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scrollable Exercises List (Shows ~4 items at a time) */}
                <div
                  ref={listScrollRef}
                  className="max-h-[248px] overflow-y-auto space-y-1 pr-0.5"
                >
                  {filteredProblems.map((prob) => {
                    const isSelected = prob.id === currentProblem.id;
                    const status = problemStatusMap[prob.id] ?? "NOT_STARTED";

                    return (
                      <button
                        key={prob.id}
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          if (prob.id !== currentProblem.id) {
                            onSelectProblem(prob.id);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#0071E3]/[0.08] text-[#1D1D1F]"
                            : "hover:bg-[#F5F5F7] text-[#1D1D1F]"
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#1D1D1F]">
                              <MathFormula latex={prob.latex} />
                            </span>

                            {status === "SOLVED" && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ECFDF3] text-[#1D9E5E]">
                                ✓ Solved
                              </span>
                            )}
                            {status === "ASSISTED" && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706]">
                                Assisted
                              </span>
                            )}
                            {status === "IN_PROGRESS" && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                                In Progress
                              </span>
                            )}
                            {prob.isReinforcement ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                                Follow-Up
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/[0.05] text-[#6E6E73]">
                                Level {prob.difficulty}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#6E6E73] truncate">
                            {prob.topicTitle}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#0071E3] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Generate 4 More Button at Bottom of List (Does NOT close dropdown!) */}
                <button
                  type="button"
                  disabled={isGeneratingMore}
                  onClick={(e) => void handleGenerateMoreClick(e)}
                  className="w-full py-2 px-3 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.06] disabled:opacity-50 text-xs font-semibold text-[#0071E3] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isGeneratingMore
                    ? "Generating 4 Exercises..."
                    : "Generate 4 More Exercises"}
                </button>

                {/* Custom Equation Form */}
                <form
                  onSubmit={handleCustomSubmit}
                  className="pt-2 border-t border-black/[0.06] flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={customEqInput}
                    onChange={(e) => setCustomEqInput(e.target.value)}
                    placeholder="Or enter custom equation: e.g. 2(x + 5) = x + 13"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3]"
                  />
                  <button
                    type="submit"
                    disabled={!customEqInput.trim()}
                    className="px-2.5 py-1.5 rounded-xl bg-[#1D1D1F] disabled:opacity-40 text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    Solve
                  </button>
                </form>
              </div>
            )}
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
          <span className="text-[11px] font-medium text-[#6E6E73]">
            {currentProblem.topicTitle}
          </span>
          {currentProblem.isReinforcement && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
              <Sparkles className="w-3 h-3" />
              Follow-Up Practice
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
          <span>Solution Steps</span>
          <div className="flex items-center gap-3">
            {fsmState.phase === "MASTERED" && (
              <span className="text-xs font-semibold text-[#1D9E5E]">
                ✓ Solved & Verified
              </span>
            )}
            <span>{notebookSteps.length} steps</span>
          </div>
        </div>

        {notebookSteps.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-black/[0.12] bg-white/80 text-center space-y-2">
            <p className="text-sm font-medium text-[#1D1D1F]">
              No steps recorded yet
            </p>
            <p className="text-xs text-[#6E6E73] max-w-sm mx-auto leading-relaxed">
              Send your equation steps in the chat on the right — every mathematical step you write is automatically verified and recorded here.
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
                          Error Detected
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
