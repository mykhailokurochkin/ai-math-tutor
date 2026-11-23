"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  Award,
  BookOpen,
  ShieldCheck,
  History,
  ChevronDown,
  ArrowUpRight,
  Lightbulb,
} from "lucide-react";
import { MathFormula, RichMathText } from "./MathRenderer";
import type {
  ExerciseHistorySummary,
  MistakeLogRecord,
  SkillMasteryRecord,
} from "@/lib/store";

interface ProgressData {
  completedProblemsCount: number;
  totalProblemsCount?: number;
  assistedProblemsCount: number;
  totalMistakesCount: number;
  resolvedMistakesCount: number;
  verifiedMistakesCount: number;
  overallMasteryPercent: number;
  mistakesLog: MistakeLogRecord[];
  skillMastery: SkillMasteryRecord[];
}

type ModalTab = "overview" | "history" | "mistakes";

export function ProgressModal({
  open,
  onClose,
  progress,
  exerciseHistory,
  onOpenProblemFromHistory,
}: {
  open: boolean;
  onClose: () => void;
  progress: ProgressData;
  exerciseHistory: ExerciseHistorySummary[];
  onOpenProblemFromHistory: (problemId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<ModalTab>("overview");
  const [expandedProblemId, setExpandedProblemId] = useState<string | null>(
    null
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl max-h-[88vh] rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Segmented Tabs */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#FBFBFD] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              Learning Progress & Solution History
            </h2>
            <p className="text-xs text-[#6E6E73]">
              Track mastered topics, solved exercises, steps, and hints given
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Apple Segmented Tab Switcher */}
            <div className="inline-flex items-center p-1 rounded-full bg-[#F5F5F7] border border-black/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Overview & Topics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Exercise History ({exerciseHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mistakes")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "mistakes"
                    ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                Mistakes Log ({progress.mistakesLog.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#1D1D1F] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
          {/* 4 Metric Cards Always Visible at Top */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
              <div className="flex items-center justify-between text-[#6E6E73] text-xs font-medium mb-1">
                <span>Overall Mastery</span>
                <Award className="w-4 h-4 text-[#0071E3]" />
              </div>
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {progress.overallMasteryPercent}%
              </div>
              <div className="text-[11px] text-[#6E6E73] mt-1">
                Across curriculum topics
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
              <div className="flex items-center justify-between text-[#6E6E73] text-xs font-medium mb-1">
                <span>Completed Exercises</span>
                <CheckCircle2 className="w-4 h-4 text-[#1D9E5E]" />
              </div>
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {progress.completedProblemsCount}
                {progress.totalProblemsCount
                  ? ` / ${progress.totalProblemsCount}`
                  : ""}
              </div>
              <div className="text-[11px] text-[#6E6E73] mt-1">
                {progress.assistedProblemsCount > 0
                  ? `${progress.assistedProblemsCount} with worked explanation`
                  : "100% independent solutions"}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
              <div className="flex items-center justify-between text-[#6E6E73] text-xs font-medium mb-1">
                <span>Mistakes Corrected</span>
                <AlertTriangle className="w-4 h-4 text-[#D97706]" />
              </div>
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {progress.resolvedMistakesCount} / {progress.totalMistakesCount}
              </div>
              <div className="text-[11px] text-[#6E6E73] mt-1">
                Diagnosed by Symbolic Verifier
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]">
              <div className="flex items-center justify-between text-[#6E6E73] text-xs font-medium mb-1">
                <span>Verified Follow-Ups</span>
                <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
              </div>
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {progress.verifiedMistakesCount}
              </div>
              <div className="text-[11px] text-[#6E6E73] mt-1">
                Confirmed on similar problems
              </div>
            </div>
          </div>

          {/* TAB 1: Overview & Topics */}
          {activeTab === "overview" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-[#0071E3]" />
                <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                  Topic Mastery Breakdown
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {progress.skillMastery.map((skill) => (
                  <div
                    key={skill.topicId}
                    className="p-4 rounded-2xl border border-black/[0.06] bg-white flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-[#1D1D1F]">
                          {skill.topicTitle}
                        </div>
                        <div className="text-xs text-[#6E6E73] mt-0.5">
                          Property:{" "}
                          <MathFormula
                            latex={skill.formulaLatex}
                            className="text-[#1D1D1F]"
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F5F5F7] text-[#1D1D1F]">
                        {skill.masteryPercent}%
                      </span>
                    </div>

                    <div>
                      <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0071E3] transition-all duration-300"
                          style={{ width: `${skill.masteryPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6E6E73] mt-1.5">
                        <span>
                          Solved: {skill.solvedCount} / {skill.totalCount ?? 4}
                        </span>
                        <span>Mistakes: {skill.mistakesCount}</span>
                        <span>
                          Verified Follow-Ups: {skill.verifiedFollowUpsCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Exercise & Hint History */}
          {activeTab === "history" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[#0071E3]" />
                <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                  Solved & Attempted Exercises (Steps & Hints History)
                </h3>
              </div>

              {exerciseHistory.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#F5F5F7] text-center text-xs text-[#6E6E73]">
                  No exercises worked on yet. Submit your first step in the workspace to build your history.
                </div>
              ) : (
                <div className="space-y-3">
                  {exerciseHistory.map((item) => {
                    const isExpanded = expandedProblemId === item.problemId;
                    return (
                      <div
                        key={item.problemId}
                        className="rounded-2xl border border-black/[0.07] bg-[#FBFBFD] overflow-hidden"
                      >
                        <div
                          onClick={() =>
                            setExpandedProblemId(
                              isExpanded ? null : item.problemId
                            )
                          }
                          className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-base font-semibold text-[#1D1D1F]">
                                <MathFormula latex={item.latex} />
                              </span>

                              {item.status === "SOLVED" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF3] text-[#1D9E5E]">
                                  ✓ Solved
                                </span>
                              )}
                              {item.status === "ASSISTED" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706]">
                                  Worked Explanation Used
                                </span>
                              )}
                              {item.status === "IN_PROGRESS" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0071E3]/10 text-[#0071E3]">
                                  In Progress
                                </span>
                              )}
                              {item.isReinforcement && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/[0.05] text-[#6E6E73]">
                                  Follow-Up
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-[#6E6E73] flex items-center gap-3 flex-wrap">
                              <span>{item.topicTitle}</span>
                              <span>·</span>
                              <span>{item.stepsCount} steps</span>
                              <span>·</span>
                              <span>{item.hintsGivenCount} hints given</span>
                              {item.mistakesCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#D92D20] font-medium">
                                    {item.mistakesCount} mistakes
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenProblemFromHistory(item.problemId);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.04] text-[#1D1D1F] transition-colors cursor-pointer"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown
                              className={`w-4 h-4 text-[#6E6E73] transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-black/[0.05] bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Column 1: Student Steps */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-[#1D1D1F]">
                                Recorded Student Steps ({item.notebookSteps.length})
                              </div>
                              {item.notebookSteps.length === 0 ? (
                                <p className="text-xs text-[#6E6E73]">
                                  No algebraic equation steps submitted yet.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {item.notebookSteps.map((s) => (
                                    <div
                                      key={s.id}
                                      className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                        s.status === "ERROR_DETECTED"
                                          ? "bg-[#FFFBF7] border-[#F3D8B6] text-[#92400E]"
                                          : "bg-[#F5F5F7] border-black/[0.05] text-[#1D1D1F]"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold">
                                          #{s.stepNumber}
                                        </span>
                                        <MathFormula latex={s.expressionLatex} />
                                      </div>
                                      <span className="text-[10px] font-medium">
                                        {s.status === "ERROR_DETECTED"
                                          ? s.errorCategory
                                          : s.status === "CORRECT_FINAL"
                                            ? "Solved ✓"
                                            : "Valid"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Column 2: Tutor Hints & Guidance Given */}
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-[#D97706]" />
                                Tutor Hints & Guidance Given ({item.tutorHints.length})
                              </div>
                              {item.tutorHints.length === 0 ? (
                                <p className="text-xs text-[#6E6E73]">
                                  Solved without needing Socratic hints.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {item.tutorHints.map((h) => (
                                    <div
                                      key={h.id}
                                      className="p-2.5 rounded-xl bg-[#FFFBEB]/80 border border-[#D97706]/20 text-xs text-[#1D1D1F] space-y-1"
                                    >
                                      <div className="flex items-center justify-between text-[10px] font-semibold text-[#B45309]">
                                        <span>Hint Level {h.hintLevel}/3</span>
                                        {h.errorTag && (
                                          <span className="font-mono">
                                            {h.errorTag}
                                          </span>
                                        )}
                                      </div>
                                      <RichMathText
                                        content={h.content}
                                        className="text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Mistakes Log */}
          {activeTab === "mistakes" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                  Diagnosed Reasoning Mistakes Log
                </h3>
              </div>

              {progress.mistakesLog.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#F5F5F7] text-center text-xs text-[#6E6E73]">
                  No reasoning mistakes recorded in this session yet. Submit an incorrect step (such as{" "}
                  <code className="px-1.5 py-0.5 bg-white rounded">
                    3x + 4 = 2x + 19
                  </code>
                  ) to test error detection and tracking.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {progress.mistakesLog.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl border border-black/[0.06] bg-[#FBFBFD] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#1D1D1F]">
                            {m.ruleTitle}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-black/[0.05] text-[#6E6E73]">
                            {m.errorCategory}
                          </span>
                        </div>
                        <div className="text-xs text-[#6E6E73]">
                          Problem:{" "}
                          <MathFormula
                            latex={m.problemEquation}
                            className="text-[#1D1D1F] font-medium"
                          />{" "}
                          → Student Step:{" "}
                          <span className="text-[#D92D20] font-medium">
                            <MathFormula latex={m.studentWrongStep} />
                          </span>
                        </div>
                        <div className="text-xs text-[#6E6E73]">
                          {m.diagnosticSummary}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {m.status === "VERIFIED_BY_FOLLOWUP" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#ECFDF3] text-[#1D9E5E] border border-[#1D9E5E]/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified by Follow-Up
                          </span>
                        )}
                        {m.status === "CORRECTED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">
                            Corrected (Pending Follow-Up)
                          </span>
                        )}
                        {m.status === "OPEN" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFF8EB] text-[#B45309] border border-[#F3D8B6]">
                            Needs Correction
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
