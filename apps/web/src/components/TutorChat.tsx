"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Lightbulb,
  BookOpenCheck,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { RichMathText } from "./MathRenderer";
import type { FSMState, PedagogicalPhase } from "@ai-math-tutor/tutor-harness";
import type { ChatMessageRecord } from "@/lib/store";

const PHASE_LABELS: Record<
  PedagogicalPhase,
  { label: string; colorClass: string }
> = {
  SOLVING: {
    label: "Active Solving",
    colorClass: "bg-[#0071E3]/10 text-[#0071E3]",
  },
  SOCRATIC_GUIDE: {
    label: "Adaptive Socratic Guidance",
    colorClass: "bg-[#D97706]/12 text-[#D97706]",
  },
  WORKED_EXAMPLE: {
    label: "Worked Explanation",
    colorClass: "bg-[#BF5AF2]/12 text-[#9333EA]",
  },
  REINFORCEMENT: {
    label: "Follow-Up Practice",
    colorClass: "bg-[#0071E3]/15 text-[#0071E3]",
  },
  MASTERED: {
    label: "Mastered ✓",
    colorClass: "bg-[#ECFDF3] text-[#1D9E5E]",
  },
};

export function TutorChat({
  chatMessages,
  fsmState,
  isSubmitting,
  onSendMessage,
  onRequestWorkedExample,
}: {
  chatMessages: ChatMessageRecord[];
  fsmState: FSMState;
  isSubmitting: boolean;
  onSendMessage: (msg: string) => void;
  onRequestWorkedExample: () => void;
}) {
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isSubmitting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSubmitting) return;
    onSendMessage(messageInput.trim());
    setMessageInput("");
  };

  const phaseMeta = PHASE_LABELS[fsmState.phase] ?? PHASE_LABELS.SOLVING;
  const canRequestWorkedExample = fsmState.failedAttemptsOnCurrentStep >= 1;

  return (
    <div className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_2px_20px_rgba(0,0,0,0.03)] flex flex-col h-full overflow-hidden">
      {/* Chat Top Header */}
      <div className="px-6 py-4 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-2 bg-[#FBFBFD]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              AI Math Tutor
            </h2>
            <p className="text-[11px] text-[#6E6E73]">
              Guided Socratic Questions · Error Diagnosis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${phaseMeta.colorClass}`}
          >
            {phaseMeta.label}
            {fsmState.phase === "SOCRATIC_GUIDE" &&
              ` · Hint ${fsmState.hintLevel}/3`}
          </span>
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={scrollRef}
        className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#FFFFFF]"
      >
        {chatMessages.map((msg) => {
          const isTutor = msg.role === "tutor";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${
                isTutor ? "items-start" : "items-end"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-medium text-[#86868B]">
                  {isTutor ? "AI Tutor" : "Student"}
                </span>
                {isTutor && msg.hintLevel && msg.hintLevel > 0 ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">
                    Hint Level {msg.hintLevel}/3
                  </span>
                ) : null}
                {isTutor && msg.errorTag ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FEF3F2] text-[#D92D20]">
                    {msg.errorTag}
                  </span>
                ) : null}
              </div>

              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                  isTutor
                    ? "bg-[#F5F5F7] text-[#1D1D1F] rounded-tl-sm border border-black/[0.04]"
                    : "bg-[#0071E3] text-white rounded-tr-sm shadow-sm"
                }`}
              >
                {isTutor ? (
                  <RichMathText content={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap font-medium">
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSubmitting && (
          <div className="flex items-center gap-2 text-xs text-[#6E6E73] px-2">
            <Sparkles className="w-3.5 h-3.5 text-[#0071E3] animate-spin" />
            <span>Verifying algebraic reasoning...</span>
          </div>
        )}
      </div>

      {/* Quick Pedagogical Chips & Chat Input */}
      <div className="p-4 border-t border-black/[0.06] bg-[#FBFBFD] space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSendMessage("Can you give me a hint?")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.04] text-[#1D1D1F] transition-colors cursor-pointer"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#D97706]" />
            Ask for a Hint
          </button>

          {canRequestWorkedExample && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onRequestWorkedExample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#FFFBEB] border border-[#D97706]/30 hover:bg-[#FEF3C7] text-[#B45309] transition-colors cursor-pointer"
              title="Unlocked after attempting: explains the step and generates a follow-up problem"
            >
              <BookOpenCheck className="w-3.5 h-3.5" />
              Show Worked Step Explanation
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Reply to the tutor or enter an equation step..."
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.1] text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all"
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || isSubmitting}
            className="w-10 h-10 rounded-2xl bg-[#1D1D1F] hover:bg-black/80 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
