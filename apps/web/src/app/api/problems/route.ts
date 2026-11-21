import { NextRequest, NextResponse } from "next/server";
import {
  getTestScenarioProblem,
  resolveActiveProviderInfo,
} from "@ai-math-tutor/tutor-harness";
import { getOrInitProfileState, resetSessionProblem } from "@/lib/store";
import { processStudentStepInStore } from "@/lib/tutorService";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      profileId?: string;
      action?: "select_problem" | "load_test_scenario" | "reset_session";
      problemId?: string;
      autoInjectWrongStep?: boolean;
    };

    const profileId = body.profileId || "reviewer";
    const currentState = getOrInitProfileState(profileId);

    if (body.action === "load_test_scenario") {
      const testProblem = getTestScenarioProblem();
      resetSessionProblem(profileId, testProblem);

      if (body.autoInjectWrongStep) {
        const injected = await processStudentStepInStore({
          profileId,
          studentMessage: "3x + 4 = 2x + 19",
        });
        return NextResponse.json({
          turn: injected.turn,
          profile: injected.state.profile,
          profiles: injected.state.profiles,
          session: injected.state.session,
          availableProblems: injected.state.availableProblems,
          progress: injected.state.progress,
          llmStatus: resolveActiveProviderInfo(),
        });
      }

      const fresh = getOrInitProfileState(profileId);
      return NextResponse.json({
        profile: fresh.profile,
        profiles: fresh.profiles,
        session: fresh.session,
        availableProblems: fresh.availableProblems,
        progress: fresh.progress,
        llmStatus: resolveActiveProviderInfo(),
      });
    }

    if (body.action === "select_problem" && body.problemId) {
      const found = currentState.availableProblems.find(
        (p) => p.id === body.problemId
      );
      if (found) {
        const updated = resetSessionProblem(profileId, found);
        return NextResponse.json({
          profile: updated.profile,
          profiles: updated.profiles,
          session: updated.session,
          availableProblems: updated.availableProblems,
          progress: updated.progress,
          llmStatus: resolveActiveProviderInfo(),
        });
      }
    }

    // Default: reset current problem session
    const reset = resetSessionProblem(
      profileId,
      currentState.session.currentProblem
    );
    return NextResponse.json({
      profile: reset.profile,
      profiles: reset.profiles,
      session: reset.session,
      availableProblems: reset.availableProblems,
      progress: reset.progress,
      llmStatus: resolveActiveProviderInfo(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update problem state",
      },
      { status: 500 }
    );
  }
}
