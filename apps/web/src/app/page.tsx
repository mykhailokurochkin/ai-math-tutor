"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { ReviewerBar } from "@/components/ReviewerBar";
import { WorkspacePane } from "@/components/WorkspacePane";
import { TutorChat } from "@/components/TutorChat";
import { HarnessInspector } from "@/components/HarnessInspector";
import { ProgressModal } from "@/components/ProgressModal";
import type {
  ActiveSessionRecord,
  MistakeLogRecord,
  SkillMasteryRecord,
  UserProfile,
} from "@/lib/store";
import type { MathProblem } from "@ai-math-tutor/tutor-harness";

interface AppStatePayload {
  profile: UserProfile;
  profiles: UserProfile[];
  session: ActiveSessionRecord;
  availableProblems: MathProblem[];
  progress: {
    completedProblemsCount: number;
    assistedProblemsCount: number;
    totalMistakesCount: number;
    resolvedMistakesCount: number;
    verifiedMistakesCount: number;
    overallMasteryPercent: number;
    mistakesLog: MistakeLogRecord[];
    skillMastery: SkillMasteryRecord[];
  };
  llmStatus: {
    provider: string;
    modelName: string;
  };
}

export default function HomePage() {
  const [data, setData] = useState<AppStatePayload | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string>("reviewer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const fetchState = useCallback(async (profileId: string) => {
    const res = await fetch(`/api/state?profileId=${encodeURIComponent(profileId)}`);
    if (res.ok) {
      const json = (await res.json()) as AppStatePayload;
      setData(json);
    }
  }, []);

  useEffect(() => {
    void fetchState(activeProfileId);
  }, [activeProfileId, fetchState]);

  const handleSelectProfile = async (profileId: string) => {
    setActiveProfileId(profileId);
    await fetchState(profileId);
  };

  const handleCreateStudent = async (name: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const json = (await res.json()) as AppStatePayload;
        setActiveProfileId(json.profile.id);
        setData(json);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendTutorStep = async (
    studentMessage: string,
    requestWorkedExample = false
  ) => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tutor/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.profile.id,
          studentMessage,
          requestWorkedExample,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as AppStatePayload;
        setData(json);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProblem = async (problemId: string) => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.profile.id,
          action: "select_problem",
          problemId,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as AppStatePayload;
        setData(json);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSession = async () => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.profile.id,
          action: "reset_session",
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as AppStatePayload;
        setData(json);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunTestScenario = async (autoInjectWrongStep: boolean) => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.profile.id,
          action: "load_test_scenario",
          autoInjectWrongStep,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as AppStatePayload;
        setData(json);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) {
    return (
      <main className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-sm font-medium text-[#6E6E73] animate-pulse">
          Завантаження AI-Тьютора...
        </div>
      </main>
    );
  }

  const isReviewer = data.profile.role === "reviewer";

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col">
      {/* Top Apple-clean Frosted Navigation Bar */}
      <HeaderBar
        activeProfile={data.profile}
        profiles={data.profiles}
        overallMasteryPercent={data.progress.overallMasteryPercent}
        completedProblemsCount={data.progress.completedProblemsCount}
        onSelectProfile={handleSelectProfile}
        onCreateStudent={handleCreateStudent}
        onOpenProgress={() => setShowProgressModal(true)}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        {/* Exclusive Reviewer Toolbar (only visible in Tech Reviewer role) */}
        {isReviewer && (
          <ReviewerBar
            isSubmitting={isSubmitting}
            showInspector={showInspector}
            onToggleInspector={() => setShowInspector((v) => !v)}
            onRunTestScenario={handleRunTestScenario}
            onQuickSendStep={(msg) => void handleSendTutorStep(msg, false)}
          />
        )}

        {/* Split-Screen Workspace: Left Notebook + Right Socratic AI Tutor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[560px] lg:h-[620px]">
          <div className="lg:col-span-7 h-full">
            <WorkspacePane
              currentProblem={data.session.currentProblem}
              availableProblems={data.availableProblems}
              fsmState={data.session.fsmState}
              notebookSteps={data.session.notebookSteps}
              isSubmitting={isSubmitting}
              onSelectProblem={(pid) => void handleSelectProblem(pid)}
              onResetSession={() => void handleResetSession()}
              onSubmitStep={(expr) => void handleSendTutorStep(expr, false)}
            />
          </div>

          <div className="lg:col-span-5 h-full">
            <TutorChat
              chatMessages={data.session.chatMessages}
              fsmState={data.session.fsmState}
              isSubmitting={isSubmitting}
              onSendMessage={(msg) => void handleSendTutorStep(msg, false)}
              onRequestWorkedExample={() =>
                void handleSendTutorStep(
                  "Покажи покроковий розбір цього кроку",
                  true
                )
              }
            />
          </div>
        </div>

        {/* Under the Hood AI Harness Inspector (only visible in Tech Reviewer role) */}
        {isReviewer && showInspector && (
          <HarnessInspector
            traces={data.session.traces}
            fsmState={data.session.fsmState}
            llmStatus={data.llmStatus}
          />
        )}
      </main>

      {/* Progress & Mastery Modal */}
      <ProgressModal
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        profile={data.profile}
        progress={data.progress}
      />
    </div>
  );
}
