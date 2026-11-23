import { NextRequest, NextResponse } from "next/server";
import {
  createCustomMathProblem,
  generateProblemBatch,
  getTestScenarioProblem,
  resolveActiveProviderInfo,
  type CurriculumTopicId,
} from "@ai-math-tutor/tutor-harness";
import {
  getOrInitProfileState,
  resetSessionProblem,
  saveDatabase,
  switchOrRestoreProblem,
} from "@/lib/store";
import { processStudentStepInStore } from "@/lib/tutorService";

function formatStateResponse(
  state: ReturnType<typeof getOrInitProfileState>,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({
    ...extra,
    profile: state.profile,
    profiles: state.profiles,
    session: state.session,
    availableProblems: state.availableProblems,
    problemStatusMap: state.problemStatusMap,
    exerciseHistory: state.exerciseHistory,
    progress: state.progress,
    llmStatus: resolveActiveProviderInfo(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      profileId?: string;
      action?:
        | "select_problem"
        | "load_test_scenario"
        | "reset_session"
        | "generate_more"
        | "custom_problem";
      problemId?: string;
      topicFilter?: CurriculumTopicId | "all";
      count?: number;
      customEquation?: string;
      autoInjectWrongStep?: boolean;
    };

    const profileId = body.profileId || "student-default";
    const currentState = getOrInitProfileState(profileId);

    if (body.action === "load_test_scenario") {
      const testProblem = getTestScenarioProblem();
      resetSessionProblem(profileId, testProblem);

      if (body.autoInjectWrongStep) {
        const injected = await processStudentStepInStore({
          profileId,
          studentMessage: "3x + 4 = 2x + 19",
        });
        return formatStateResponse(injected.state, { turn: injected.turn });
      }

      return formatStateResponse(getOrInitProfileState(profileId));
    }

    // Appends 4 new CAS-verified exercises to the dropdown WITHOUT resetting the current problem or closing the dropdown
    if (body.action === "generate_more") {
      const topicFilter = body.topicFilter || "all";
      const count = body.count || 4;
      const existingEqs = currentState.availableProblems.map((p) => p.equation);

      const newBatch = generateProblemBatch(topicFilter, count, existingEqs);
      const customList =
        currentState.db.customProblems[currentState.profile.id] ?? [];
      customList.push(...newBatch);
      currentState.db.customProblems[currentState.profile.id] = customList;
      saveDatabase(currentState.db);

      return formatStateResponse(getOrInitProfileState(profileId), {
        generatedBatch: newBatch,
      });
    }

    if (body.action === "custom_problem" && body.customEquation) {
      const customProb = createCustomMathProblem(body.customEquation);
      if (!customProb) {
        return NextResponse.json(
          {
            error:
              "Could not parse a valid linear equation in x (e.g. 2(x + 3) = x + 10).",
          },
          { status: 400 }
        );
      }

      const customList =
        currentState.db.customProblems[currentState.profile.id] ?? [];
      customList.push(customProb);
      currentState.db.customProblems[currentState.profile.id] = customList;
      saveDatabase(currentState.db);

      const updated = switchOrRestoreProblem(profileId, customProb);
      return formatStateResponse(updated);
    }

    if (body.action === "select_problem" && body.problemId) {
      const found = currentState.availableProblems.find(
        (p) => p.id === body.problemId
      );
      if (found) {
        const updated = switchOrRestoreProblem(profileId, found);
        return formatStateResponse(updated);
      }
    }

    const reset = resetSessionProblem(
      profileId,
      currentState.session.currentProblem
    );
    return formatStateResponse(reset);
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
