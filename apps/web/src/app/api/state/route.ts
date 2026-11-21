import { NextRequest, NextResponse } from "next/server";
import { getOrInitProfileState } from "@/lib/store";
import { resolveActiveProviderInfo } from "@ai-math-tutor/tutor-harness";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId") ?? "reviewer";
  const state = getOrInitProfileState(profileId);
  const providerInfo = resolveActiveProviderInfo();

  return NextResponse.json({
    profile: state.profile,
    profiles: state.profiles,
    session: state.session,
    availableProblems: state.availableProblems,
    progress: state.progress,
    llmStatus: providerInfo,
  });
}
