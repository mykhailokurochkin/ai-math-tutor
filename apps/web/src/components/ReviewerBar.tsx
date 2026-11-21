"use client";

import React from "react";
import {
  Play,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CheckCircle,
  CornerDownRight,
} from "lucide-react";

export function ReviewerBar({
  isSubmitting,
  showInspector,
  onToggleInspector,
  onRunTestScenario,
  onQuickSendStep,
}: {
  isSubmitting: boolean;
  showInspector: boolean;
  onToggleInspector: () => void;
  onRunTestScenario: (autoInjectWrongStep: boolean) => void;
  onQuickSendStep: (msg: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#16161A] text-[#F5F5F7] px-4 py-2.5 border border-white/10 shadow-md flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0A84FF]/20 text-[#0A84FF] border border-[#0A84FF]/30">
          <SlidersHorizontal className="w-3 h-3" />
          Test Scenario Controls
        </span>

        {/* 1-Click Test Scenario from Assignment Brief */}
        <button
          onClick={() => onRunTestScenario(true)}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0A84FF] hover:bg-[#0071E3] disabled:opacity-40 text-white transition-all cursor-pointer shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          1. Run Test Scenario: 3(x + 4) = 2x + 19 → 3x + 4 = 2x + 19
        </button>

        {/* Sequential Steps to verify correction & follow-up problem generation */}
        <div className="hidden lg:flex items-center gap-1.5 pl-1 border-l border-white/10">
          <button
            onClick={() => onQuickSendStep("3x + 12 = 2x + 19")}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.07] hover:bg-white/[0.14] text-[#D1D1D6] transition-colors cursor-pointer"
            title="Submit corrected bracket expansion"
          >
            <CornerDownRight className="w-3 h-3 text-[#30D158]" />
            2. Correct Error: 3x + 12 = 2x + 19
          </button>

          <button
            onClick={() => onQuickSendStep("x = 7")}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.07] hover:bg-white/[0.14] text-[#D1D1D6] transition-colors cursor-pointer"
            title="Solve equation and trigger follow-up practice problem"
          >
            <CheckCircle className="w-3 h-3 text-[#30D158]" />
            3. Solve: x = 7 (→ Generate Follow-Up)
          </button>
        </div>
      </div>

      {/* Inspector Toggle */}
      <button
        onClick={onToggleInspector}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors cursor-pointer"
      >
        {showInspector ? (
          <>
            <EyeOff className="w-3.5 h-3.5 text-[#A1A1A6]" />
            Hide Harness Inspector
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5 text-[#0A84FF]" />
            Show Harness Inspector
          </>
        )}
      </button>
    </div>
  );
}
