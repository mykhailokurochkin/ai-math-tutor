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
  Layers,
} from "lucide-react";
import { MathFormula } from "./MathRenderer";
import type {
  MathProblem,
  FSMState,
  CurriculumTopicId,
} from "@ai-math-tutor/tutor-harness";
import type { NotebookStepRecord } from "@/lib/store";

const STATIC_CURRICULUM_TOPICS: Array<{
  id: CurriculumTopicId;
  title: string;
  shortTitle: string;
  formulaLatex: string;
  difficulty: 1 | 2 | 3;
}> = [
  {
    id: "topic-distributive",
    title: "Distributive Property",
    shortTitle: "Distributive Property",
    formulaLatex: "a(b + c) = ab + ac",
    difficulty: 1,
  },
  {
    id: "topic-transposition",
    title: "Transposition & Signs",
    shortTitle: "Transposition & Signs",
    formulaLatex: "A + B = C \\implies A = C - B",
    difficulty: 1,
  },
  {
    id: "topic-like-terms",
    title: "Combining Like Terms",
    shortTitle: "Combining Like Terms",
    formulaLatex: "ax + bx = (a + b)x",
    difficulty: 2,
  },
  {
    id: "topic-olympiad",
    title: "Multi-Bracket Equations",
    shortTitle: "Multi-Bracket Equations",
    formulaLatex: "a(mx + b) - k(x - c) = dx + e",
    difficulty: 3,
  },
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
  onGenerateMoreProblems: (topicId: CurriculumTopicId) => Promise<void>;
  onSubmitCustomProblem: (
    customEquation: string,
    topicId: CurriculumTopicId
  ) => void;
  onResetSession: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<"none" | "topic" | "exercise">(
    "none"
  );
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [customEqInput, setCustomEqInput] = useState("");
  const headerControlsRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  const activeTopicId: CurriculumTopicId =
    STATIC_CURRICULUM_TOPICS.some((t) => t.id === currentProblem.topicId)
      ? (currentProblem.topicId as CurriculumTopicId)
      : "topic-distributive";

  const activeTopicMeta =
    STATIC_CURRICULUM_TOPICS.find((t) => t.id === activeTopicId) ??
    STATIC_CURRICULUM_TOPICS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        headerControlsRef.current &&
        !headerControlsRef.current.contains(e.target as Node)
      ) {
        setOpenMenu("none");
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu("none");
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Filter exercises strictly to the active topic
  const topicProblems = availableProblems.filter(
    (p) => p.topicId === activeTopicId
  );

  const currentIndexInTopic = topicProblems.findIndex(
    (p) => p.id === currentProblem.id
  );

  const solvedInActiveTopic = topicProblems.filter(
    (p) => problemStatusMap[p.id] === "SOLVED"
  ).length;

  const handleSwitchTopic = (newTopicId: CurriculumTopicId) => {
    setOpenMenu("none");
    if (newTopicId === activeTopicId || isSubmitting) return;

    const matching = availableProblems.filter((p) => p.topicId === newTopicId);
    if (matching.length > 0) {
      // Restore in-progress problem in that topic if any, else first unsolved, else first problem
      const inProgress = matching.find(
        (p) => problemStatusMap[p.id] === "IN_PROGRESS"
      );
      const firstUnsolved = matching.find(
        (p) => problemStatusMap[p.id] === "NOT_STARTED"
      );
      const target = inProgress ?? firstUnsolved ?? matching[0];
      onSelectProblem(target.id);
    }
  };

  const handleGenerateMoreClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGeneratingMore) return;
    setIsGeneratingMore(true);
    try {
      await onGenerateMoreProblems(activeTopicId);
      // Keep dropdown open and scroll smoothly to newly added exercises
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
    onSubmitCustomProblem(customEqInput.trim(), activeTopicId);
    setCustomEqInput("");
    setOpenMenu("none");
  };

  const currentStatus = problemStatusMap[currentProblem.id] ?? "NOT_STARTED";

  return (
    <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex flex-col h-full min-h-0 overflow-hidden">
      {/* Unified Header Row with Paired Custom Dropdowns: [1. Topic Dropdown] + [2. Exercise Dropdown] + [Reset] */}
      <div
        ref={headerControlsRef}
        className="px-5 py-3.5 border-b border-black/[0.06] bg-[#FBFBFD] flex flex-wrap items-center justify-between gap-2.5 shrink-0"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          {/* DROPDOWN 1: TOPIC SELECTOR */}
          <div className="relative">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                setOpenMenu((prev) => (prev === "topic" ? "none" : "topic"))
              }
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                openMenu === "topic"
                  ? "bg-white border-[#0071E3] shadow-sm text-[#1D1D1F]"
                  : "bg-[#F5F5F7] hover:bg-black/[0.06] border-black/[0.06] text-[#1D1D1F]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
              <span className="text-[#6E6E73] font-medium">Topic:</span>
              <span className="font-semibold text-[#1D1D1F] truncate max-w-[150px] sm:max-w-[190px]">
                {activeTopicMeta.shortTitle}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  solvedInActiveTopic > 0
                    ? "bg-[#ECFDF3] text-[#1D9E5E]"
                    : "bg-black/[0.05] text-[#6E6E73]"
                }`}
              >
                {solvedInActiveTopic}/{topicProblems.length}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6E6E73] transition-transform duration-150 shrink-0 ${
                  openMenu === "topic" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Topic Popover Menu */}
            {openMenu === "topic" && (
              <div className="absolute left-0 mt-1.5 w-[340px] sm:w-[380px] rounded-2xl bg-white/95 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.14)] border border-black/[0.08] p-2 z-40 space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Select Algebra Topic
                </div>
                {STATIC_CURRICULUM_TOPICS.map((topic) => {
                  const isSelected = topic.id === activeTopicId;
                  const items = availableProblems.filter(
                    (p) => p.topicId === topic.id
                  );
                  const solvedCount = items.filter(
                    (p) => problemStatusMap[p.id] === "SOLVED"
                  ).length;
                  const inProgressCount = items.filter(
                    (p) => problemStatusMap[p.id] === "IN_PROGRESS"
                  ).length;

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSwitchTopic(topic.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#0071E3]/[0.08] text-[#1D1D1F]"
                          : "hover:bg-[#F5F5F7] text-[#1D1D1F]"
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#1D1D1F]">
                            {topic.title}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/[0.05] text-[#6E6E73]">
                            Level {topic.difficulty}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6E6E73]">
                          Rule:{" "}
                          <MathFormula
                            latex={topic.formulaLatex}
                            className="text-[#1D1D1F]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {inProgressCount > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                            Active
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            solvedCount > 0
                              ? "bg-[#ECFDF3] text-[#1D9E5E]"
                              : "bg-black/[0.05] text-[#6E6E73]"
                          }`}
                        >
                          {solvedCount}/{items.length} solved
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#0071E3] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* DROPDOWN 2: EXERCISE SELECTOR (WITHIN ACTIVE TOPIC) */}
          <div className="relative">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                setOpenMenu((prev) =>
                  prev === "exercise" ? "none" : "exercise"
                )
              }
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                openMenu === "exercise"
                  ? "bg-white border-[#0071E3] shadow-sm text-[#1D1D1F]"
                  : "bg-[#F5F5F7] hover:bg-black/[0.06] border-black/[0.06] text-[#1D1D1F]"
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
              <span className="text-[#6E6E73] font-medium shrink-0">
                #{currentIndexInTopic >= 0 ? currentIndexInTopic + 1 : 1}:
              </span>
              <span className="font-semibold text-[#1D1D1F] shrink-0">
                <MathFormula latex={currentProblem.latex} />
              </span>
              {currentStatus === "SOLVED" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ECFDF3] text-[#1D9E5E] shrink-0">
                  ✓
                </span>
              )}
              {currentProblem.isReinforcement && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#0071E3]/10 text-[#0071E3] shrink-0">
                  Follow-Up
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6E6E73] transition-transform duration-150 shrink-0 ${
                  openMenu === "exercise" ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Exercise Popover Menu (Shows 4 at a time + Generate 4 More without closing) */}
            {openMenu === "exercise" && (
              <div className="absolute left-0 mt-1.5 w-[350px] sm:w-[420px] rounded-2xl bg-white/95 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.14)] border border-black/[0.08] p-2.5 z-40 space-y-2">
                <div className="flex items-center justify-between px-2 pt-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                    {activeTopicMeta.shortTitle} · {topicProblems.length} Exercises
                  </span>
                </div>

                {/* Scrollable List of 4 Visible Exercises at a time */}
                <div
                  ref={listScrollRef}
                  className="max-h-[224px] overflow-y-auto space-y-1 pr-0.5"
                >
                  {topicProblems.map((prob, idx) => {
                    const isSelected = prob.id === currentProblem.id;
                    const status = problemStatusMap[prob.id] ?? "NOT_STARTED";

                    return (
                      <button
                        key={prob.id}
                        type="button"
                        onClick={() => {
                          setOpenMenu("none");
                          if (prob.id !== currentProblem.id) {
                            onSelectProblem(prob.id);
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#0071E3]/[0.08] text-[#1D1D1F]"
                            : "hover:bg-[#F5F5F7] text-[#1D1D1F]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-black/[0.05] text-[11px] font-mono font-semibold text-[#6E6E73] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-[#1D1D1F]">
                            <MathFormula latex={prob.latex} />
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
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
                          {prob.isReinforcement && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                              Follow-Up
                            </span>
                          )}
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#0071E3] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Generate 4 More Exercises in This Topic (Stays Open!) */}
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

                {/* Custom Equation Input */}
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

        {/* Reset Current Exercise Button */}
        <button
          onClick={onResetSession}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] transition-colors cursor-pointer shrink-0"
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
            {activeTopicMeta.title} · Rule:{" "}
            <MathFormula
              latex={activeTopicMeta.formulaLatex}
              className="text-[#1D1D1F]"
            />
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
