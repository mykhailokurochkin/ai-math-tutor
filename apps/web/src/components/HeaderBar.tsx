"use client";

import React, { useState } from "react";
import {
  BarChart3,
  UserPlus,
  Shield,
  User,
  Check,
  Sigma,
} from "lucide-react";
import type { UserProfile } from "@/lib/store";

export function HeaderBar({
  activeProfile,
  profiles,
  overallMasteryPercent,
  completedProblemsCount,
  onSelectProfile,
  onCreateStudent,
  onOpenProgress,
}: {
  activeProfile: UserProfile;
  profiles: UserProfile[];
  overallMasteryPercent: number;
  completedProblemsCount: number;
  onSelectProfile: (profileId: string) => void;
  onCreateStudent: (name: string) => void;
  onOpenProgress: () => void;
}) {
  const [showNewStudentForm, setShowNewStudentForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");

  const reviewerProfile = profiles.find((p) => p.role === "reviewer");
  const studentProfiles = profiles.filter((p) => p.role === "student");
  const activeStudent =
    activeProfile.role === "student"
      ? activeProfile
      : studentProfiles[0];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onCreateStudent(newStudentName.trim());
    setNewStudentName("");
    setShowNewStudentForm(false);
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-black/[0.06]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-sm">
            <Sigma className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-[#1D1D1F] tracking-tight">
                Sokrat · AI Math Tutor
              </h1>
              <span className="hidden md:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/[0.05] text-[#6E6E73]">
                USSR Math System
              </span>
            </div>
            <p className="text-[11px] text-[#6E6E73] hidden sm:block">
              Нейро-символьний тьютор · Алгебра 7 клас (Кісельов / Макаричев)
            </p>
          </div>
        </div>

        {/* Center: Apple Segmented Role / Profile Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-full bg-[#F5F5F7] border border-black/[0.06]">
            {reviewerProfile && (
              <button
                type="button"
                onClick={() => onSelectProfile(reviewerProfile.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeProfile.role === "reviewer"
                    ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Tech Reviewer</span>
              </button>
            )}

            {activeStudent && (
              <button
                type="button"
                onClick={() => onSelectProfile(activeStudent.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeProfile.role === "student"
                    ? "bg-white text-[#1D1D1F] shadow-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#1D9E5E]" />
                <span>Учень: {activeStudent.name}</span>
              </button>
            )}
          </div>

          {/* Student Selector if multiple students exist + Add Student */}
          {activeProfile.role === "student" && studentProfiles.length > 1 && (
            <select
              value={activeProfile.id}
              onChange={(e) => onSelectProfile(e.target.value)}
              className="text-xs font-medium bg-[#F5F5F7] border border-black/[0.06] rounded-full px-3 py-1.5 text-[#1D1D1F] focus:outline-none cursor-pointer"
            >
              {studentProfiles.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  {stu.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNewStudentForm((v) => !v)}
              className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] border border-black/[0.06] flex items-center justify-center text-[#1D1D1F] transition-colors cursor-pointer"
              title="Додати нового учня"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>

            {showNewStudentForm && (
              <form
                onSubmit={handleCreateSubmit}
                className="absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-white shadow-xl border border-black/[0.08] flex items-center gap-2 z-40"
              >
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Ім'я нового учня..."
                  autoFocus
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-[#1D1D1F] focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-7 h-7 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right: Progress & Mastery Dashboard Button */}
        <button
          type="button"
          onClick={onOpenProgress}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-black/[0.07] border border-black/[0.06] text-xs font-medium text-[#1D1D1F] transition-all cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="hidden sm:inline">Прогрес:</span>
          <span className="font-semibold text-[#0071E3]">
            {overallMasteryPercent}%
          </span>
          <span className="text-[#86868B] hidden md:inline">
            ({completedProblemsCount} задач)
          </span>
        </button>
      </div>
    </header>
  );
}
