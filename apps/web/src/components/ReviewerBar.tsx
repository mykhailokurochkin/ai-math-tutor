"use client";

import React from "react";
import {
  Play,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CheckCircle,
  CornerDownRight,
  Sparkles,
} from "lucide-react";
import type { MathProblem } from "@ai-math-tutor/tutor-harness";

export function ReviewerBar({
  isSubmitting,
  showInspector,
  currentProblem,
  pendingFollowUpProblem,
  onToggleInspector,
  onRunTestScenario,
  onQuickSendStep,
}: {
  isSubmitting: boolean;
  showInspector: boolean;
  currentProblem: MathProblem;
  pendingFollowUpProblem?: MathProblem | null;
  onToggleInspector: () => void;
  onRunTestScenario: (autoInjectWrongStep: boolean) => void;
  onQuickSendStep: (msg: string) => void;
}) {
  const followUpTarget =
    pendingFollowUpProblem ??
    (currentProblem.isReinforcement ? currentProblem : null);

  return (
    <div className="rounded-2xl bg-[#16161A] text-[#F5F5F7] px-4 py-2.5 border border-white/10 shadow-md flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30 mr-1">
          <SlidersHorizontal className="w-3 h-3" />
          Test Scenario Flow
        </span>

        {/* Step 1: Load 3(x + 4) = 2x + 19 and submit wrong step 3x + 4 = 2x + 19 */}
        <button
          onClick={() => onRunTestScenario(true)}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] hover:bg-[#0071E3] disabled:opacity-40 text-white transition-all cursor-pointer shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          1. Inject Error: 3x + 4 = 2x + 19
        </button>

        {/* Step 2: Submit corrected expansion */}
        <button
          onClick={() => onQuickSendStep("3x + 12 = 2x + 19")}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 text-[#E5E5EA] transition-colors cursor-pointer"
        >
          <CornerDownRight className="w-3 h-3 text-[#30D158]" />
          2. Fix Step: 3x + 12 = 2x + 19
        </button>

        {/* Step 3: Solve root x = 7 -> triggers follow-up problem generation */}
        <button
          onClick={() => onQuickSendStep("x = 7")}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 text-[#E5E5EA] transition-colors cursor-pointer"
        >
          <CheckCircle className="w-3 h-3 text-[#30D158]" />
          3. Solve: x = 7
        </button>

        {/* Step 4: Verify Follow-Up Problem (if generated) */}
        {followUpTarget && (
          <button
            onClick={() =>
              onQuickSendStep(`x = ${followUpTarget.expectedRoot}`)
            }
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#30D158]/20 hover:bg-[#30D158]/30 border border-[#30D158]/40 text-[#30D158] transition-colors cursor-pointer"
            title={`Solve generated follow-up problem (${followUpTarget.equation})`}
          >
            <Sparkles className="w-3 h-3" />
            4. Solve Follow-Up (x = {followUpTarget.expectedRoot})
          </button>
        )}
      </div>

      {/* Inspector Toggle */}
      <button
        onClick={onToggleInspector}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors cursor-pointer shrink-0"
      >
        {showInspector ? (
          <>
            <EyeOff className="w-3.5 h-3.5 text-[#A1A1A6]" />
            Hide Inspector
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5 text-[#0A84FF]" />
            Harness Inspector
          </>
        )}
      </button>
    </div>
  );
}
