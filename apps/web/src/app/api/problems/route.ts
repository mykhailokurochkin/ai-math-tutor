import { NextRequest, NextResponse } from "next/server";
import {
  createCustomMathProblem,
  generateIsomorphicProblem,
  getTestScenarioProblem,
  resolveActiveProviderInfo,
} from "@ai-math-tutor/tutor-harness";
import { getOrInitProfileState, resetSessionProblem, saveDatabase } from "@/lib/store";
import { processStudentStepInStore } from "@/lib/tutorService";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      profileId?: string;
      action?:
        | "select_problem"
        | "load_test_scenario"
        | "reset_session"
        | "generate_new"
        | "custom_problem";
      problemId?: string;
      customEquation?: string;
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

    if (body.action === "generate_new") {
      const source = currentState.session.currentProblem;
      const generated = generateIsomorphicProblem(
        source,
        source.targetSkill === "LINEAR_EQUATIONS"
          ? "DISTRIBUTIVE_PROPERTY"
          : source.targetSkill
      );
      generated.isReinforcement = false;
      generated.topicTitle = source.topicTitle.replace(
        " (Follow-Up Practice)",
        ""
      );

      const customList = currentState.db.customProblems[currentState.profile.id] ?? [];
      customList.push(generated);
      currentState.db.customProblems[currentState.profile.id] = customList;
      saveDatabase(currentState.db);

      const updated = resetSessionProblem(profileId, generated);
      return NextResponse.json({
        profile: updated.profile,
        profiles: updated.profiles,
        session: updated.session,
        availableProblems: updated.availableProblems,
        progress: updated.progress,
        llmStatus: resolveActiveProviderInfo(),
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

      const customList = currentState.db.customProblems[currentState.profile.id] ?? [];
      customList.push(customProb);
      currentState.db.customProblems[currentState.profile.id] = customList;
      saveDatabase(currentState.db);

      const updated = resetSessionProblem(profileId, customProb);
      return NextResponse.json({
        profile: updated.profile,
        profiles: updated.profiles,
        session: updated.session,
        availableProblems: updated.availableProblems,
        progress: updated.progress,
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
