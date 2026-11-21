"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  Award,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { MathFormula } from "./MathRenderer";
import type { MistakeLogRecord, SkillMasteryRecord, UserProfile } from "@/lib/store";

interface ProgressData {
  completedProblemsCount: number;
  assistedProblemsCount: number;
  totalMistakesCount: number;
  resolvedMistakesCount: number;
  verifiedMistakesCount: number;
  overallMasteryPercent: number;
  mistakesLog: MistakeLogRecord[];
  skillMastery: SkillMasteryRecord[];
}

export function ProgressModal({
  open,
  onClose,
  profile,
  progress,
}: {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  progress: ProgressData;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl max-h-[88vh] rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-semibold text-sm">
              {profile.avatarBadge}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Learning Progress & Mistake Tracking — {profile.name}
              </h2>
              <p className="text-xs text-[#6E6E73]">
                {profile.grade}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#1D1D1F] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 4 Metric Cards */}
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
                <span>Verified by Follow-Up</span>
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

          {/* Skill Mastery Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[#0071E3]" />
              <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Topic Mastery (Classical USSR Curriculum)
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
                      <span>Solved: {skill.solvedCount}</span>
                      <span>Mistakes: {skill.mistakesCount}</span>
                      <span>Verified Follow-Ups: {skill.verifiedFollowUpsCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mistakes Log */}
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FEF3F2] text-[#D92D20] border border-[#D92D20]/20">
                          Needs Correction
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
