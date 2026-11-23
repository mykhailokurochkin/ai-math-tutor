"use client";

import React from "react";
import { BarChart3, Shield, User, Sigma } from "lucide-react";
import type { UserProfile } from "@/lib/store";

export function HeaderBar({
  activeProfile,
  profiles,
  overallMasteryPercent,
  completedProblemsCount,
  onSelectProfile,
  onOpenProgress,
}: {
  activeProfile: UserProfile;
  profiles: UserProfile[];
  overallMasteryPercent: number;
  completedProblemsCount: number;
  onSelectProfile: (profileId: string) => void;
  onOpenProgress: () => void;
}) {
  const reviewerProfile = profiles.find((p) => p.role === "reviewer");
  const studentProfiles = profiles.filter((p) => p.role === "student");
  const activeStudent =
    activeProfile.role === "student" ? activeProfile : studentProfiles[0];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-black/[0.06] shrink-0">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Minimal Brand Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-sm">
            <Sigma className="w-4 h-4" />
          </div>
          <h1 className="text-sm sm:text-base font-semibold text-[#1D1D1F] tracking-tight">
            AI Math Tutor
          </h1>
        </div>

        {/* Center: Clean Apple Segmented Role Switcher */}
        <div className="inline-flex items-center p-1 rounded-full bg-[#F5F5F7] border border-black/[0.06]">
          {reviewerProfile && (
            <button
              type="button"
              onClick={() => onSelectProfile(reviewerProfile.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeProfile.role === "reviewer"
                  ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Reviewer View</span>
            </button>
          )}

          {activeStudent && (
            <button
              type="button"
              onClick={() => onSelectProfile(activeStudent.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                activeProfile.role === "student"
                  ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <User className="w-3.5 h-3.5 text-[#1D9E5E]" />
              <span>Student View</span>
            </button>
          )}
        </div>

        {/* Right: Progress Tracking Button */}
        <button
          type="button"
          onClick={onOpenProgress}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-black/[0.07] border border-black/[0.06] text-xs font-medium text-[#1D1D1F] transition-all cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="hidden sm:inline">Progress:</span>
          <span className="font-semibold text-[#0071E3]">
            {overallMasteryPercent}%
          </span>
          <span className="text-[#86868B] hidden md:inline">
            ({completedProblemsCount} solved)
          </span>
        </button>
      </div>
    </header>
  );
}
