import { NextRequest, NextResponse } from "next/server";
import { processStudentStepInStore } from "@/lib/tutorService";
import { resolveActiveProviderInfo } from "@ai-math-tutor/tutor-harness";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      profileId?: string;
      studentMessage?: string;
      requestWorkedExample?: boolean;
    };

    const profileId = body.profileId || "student-default";
    const studentMessage = (body.studentMessage ?? "").trim();

    if (!studentMessage && !body.requestWorkedExample) {
      return NextResponse.json(
        { error: "studentMessage is required" },
        { status: 400 }
      );
    }

    const result = await processStudentStepInStore({
      profileId,
      studentMessage:
        studentMessage || "Show worked explanation for this step",
      requestWorkedExample: Boolean(body.requestWorkedExample),
    });

    return NextResponse.json({
      turn: result.turn,
      profile: result.state.profile,
      profiles: result.state.profiles,
      session: result.state.session,
      availableProblems: result.state.availableProblems,
      problemStatusMap: result.state.problemStatusMap,
      exerciseHistory: result.state.exerciseHistory,
      progress: result.state.progress,
      llmStatus: resolveActiveProviderInfo(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to process tutor step",
      },
      { status: 500 }
    );
  }
}
