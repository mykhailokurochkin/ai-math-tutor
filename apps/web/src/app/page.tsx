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
  ExerciseHistorySummary,
  MistakeLogRecord,
  SkillMasteryRecord,
  UserProfile,
} from "@/lib/store";
import type {
  CurriculumTopicId,
  MathProblem,
} from "@ai-math-tutor/tutor-harness";

interface AppStatePayload {
  profile: UserProfile;
  profiles: UserProfile[];
  session: ActiveSessionRecord;
  availableProblems: MathProblem[];
  problemStatusMap: Record<
    string,
    "NOT_STARTED" | "IN_PROGRESS" | "SOLVED" | "ASSISTED"
  >;
  exerciseHistory: ExerciseHistorySummary[];
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
  const [activeProfileId, setActiveProfileId] =
    useState<string>("student-default");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const fetchState = useCallback(async (profileId: string) => {
    const res = await fetch(
      `/api/state?profileId=${encodeURIComponent(profileId)}`
    );
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

  const handleGenerateMoreProblems = async (
    topicFilter: CurriculumTopicId | "all"
  ) => {
    if (!data) return;
    const res = await fetch("/api/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: data.profile.id,
        action: "generate_more",
        topicFilter,
        count: 4,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as AppStatePayload;
      setData(json);
    }
  };

  const handleSubmitCustomProblem = async (customEquation: string) => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: data.profile.id,
          action: "custom_problem",
          customEquation,
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
      <main className="h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-sm font-medium text-[#6E6E73] animate-pulse">
          Loading AI Math Tutor...
        </div>
      </main>
    );
  }

  const isReviewer = data.profile.role === "reviewer";

  return (
    <div className="h-screen overflow-hidden bg-[#F5F5F7] text-[#1D1D1F] flex flex-col">
      {/* Top Apple-clean Frosted Navigation Bar */}
      <HeaderBar
        activeProfile={data.profile}
        profiles={data.profiles}
        overallMasteryPercent={data.progress.overallMasteryPercent}
        completedProblemsCount={data.progress.completedProblemsCount}
        onSelectProfile={handleSelectProfile}
        onOpenProgress={() => setShowProgressModal(true)}
      />

      {/* Main Content Container — Fixed Viewport Height, Zero Page Growth */}
      <main className="flex-1 min-h-0 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3.5 overflow-hidden">
        {/* Exclusive Reviewer Toolbar (only visible in Reviewer View) */}
        {isReviewer && (
          <div className="shrink-0">
            <ReviewerBar
              isSubmitting={isSubmitting}
              showInspector={showInspector}
              onToggleInspector={() => setShowInspector((v) => !v)}
              onRunTestScenario={handleRunTestScenario}
              onQuickSendStep={(msg) => void handleSendTutorStep(msg, false)}
            />
          </div>
        )}

        {/* Split-Screen Workspace: Left Solution Board + Right Socratic AI Tutor */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          <div className="lg:col-span-6 h-full min-h-0 overflow-hidden">
            <WorkspacePane
              currentProblem={data.session.currentProblem}
              availableProblems={data.availableProblems}
              problemStatusMap={data.problemStatusMap ?? {}}
              fsmState={data.session.fsmState}
              notebookSteps={data.session.notebookSteps}
              isSubmitting={isSubmitting}
              onSelectProblem={(pid) => void handleSelectProblem(pid)}
              onGenerateMoreProblems={handleGenerateMoreProblems}
              onSubmitCustomProblem={(eq) => void handleSubmitCustomProblem(eq)}
              onResetSession={() => void handleResetSession()}
            />
          </div>

          <div className="lg:col-span-6 h-full min-h-0 overflow-hidden">
            <TutorChat
              chatMessages={data.session.chatMessages}
              fsmState={data.session.fsmState}
              isSubmitting={isSubmitting}
              onSendMessage={(msg) => void handleSendTutorStep(msg, false)}
              onRequestWorkedExample={() =>
                void handleSendTutorStep(
                  "Show worked explanation for this step",
                  true
                )
              }
            />
          </div>
        </div>

        {/* Under the Hood AI Harness Inspector (compact collapsible drawer in Reviewer View) */}
        {isReviewer && showInspector && (
          <div className="shrink-0 max-h-[220px] overflow-y-auto">
            <HarnessInspector
              traces={data.session.traces}
              fsmState={data.session.fsmState}
              llmStatus={data.llmStatus}
            />
          </div>
        )}
      </main>

      {/* Progress, Solution History & Mistakes Modal */}
      <ProgressModal
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progress={data.progress}
        exerciseHistory={data.exerciseHistory ?? []}
        onOpenProblemFromHistory={(pid) => void handleSelectProblem(pid)}
      />
    </div>
  );
}
