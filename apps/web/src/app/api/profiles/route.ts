import { NextRequest, NextResponse } from "next/server";
import { createNewProfile, getOrInitProfileState } from "@/lib/store";
import { resolveActiveProviderInfo } from "@ai-math-tutor/tutor-harness";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      grade?: string;
    };

    const created = createNewProfile(
      body.name || "New Student",
      body.grade || "Grade 7 Algebra · Classical USSR Curriculum",
      "student"
    );

    const state = getOrInitProfileState(created.id);
    return NextResponse.json({
      profile: state.profile,
      profiles: state.profiles,
      session: state.session,
      availableProblems: state.availableProblems,
      progress: state.progress,
      llmStatus: resolveActiveProviderInfo(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create student profile",
      },
      { status: 500 }
    );
  }
}
