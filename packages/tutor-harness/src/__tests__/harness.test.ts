import { describe, expect, it } from "vitest";
import {
  createInitialFSMState,
  enforceLeakageGate,
  extractEquationFromText,
  generateIsomorphicProblem,
  getTestScenarioProblem,
  runTutorHarnessTurn,
  verifyStudentStep,
} from "../index";

describe("Neuro-Symbolic Pedagogical Harness (@ai-math-tutor/tutor-harness)", () => {
  it("1. Hybrid Normalizer extracts equations from conversational text & normalizes Cyrillic х", () => {
    const eq1 = extractEquationFromText(
      "Я розкрив дужки і в мене вийшло 3x + 4 = 2x + 19."
    );
    expect(eq1).toBe("3x + 4 = 2x + 19");

    const eq2 = extractEquationFromText("Думаю, що 3х + 12 = 2х + 19!");
    expect(eq2).toBe("3x + 12 = 2x + 19");
  });

  it("2. Test Scenario Error Detection: identifies DISTRIBUTIVE_PROPERTY mistake in 3(x + 4) = 2x + 19 -> 3x + 4 = 2x + 19", () => {
    const problem = getTestScenarioProblem();
    expect(problem.equation).toBe("3(x + 4) = 2x + 19");
    expect(problem.expectedRoot).toBe(7);

    const res = verifyStudentStep(
      "3x + 4 = 2x + 19",
      problem.equation,
      problem.expectedRoot
    );

    expect(res.hasMathExpression).toBe(true);
    expect(res.isEquivalentToTarget).toBe(false);
    expect(res.targetRoot).toBe(7);
    expect(res.studentRoot).toBe(15);
    expect(res.lhsExpected.formatted).toBe("3x + 12");
    expect(res.lhsStudent?.formatted).toBe("3x + 4");
    expect(res.errorCategory).toBe("DISTRIBUTIVE_PROPERTY");
  });

  it("3. Full Pedagogical Loop on Test Scenario: Error -> Socratic Guide -> Correction -> Reinforcement Problem -> Mastery", async () => {
    const problem = getTestScenarioProblem();
    let state = createInitialFSMState(problem);

    // Turn 1: Student writes wrong step "3x + 4 = 2x + 19"
    const turn1 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "3x + 4 = 2x + 19",
    });

    expect(turn1.stepStatus).toBe("ERROR_DETECTED");
    expect(turn1.nextFsmState.phase).toBe("SOCRATIC_GUIDE");
    expect(turn1.nextFsmState.hintLevel).toBe(1);
    expect(turn1.nextFsmState.activeErrorCategory).toBe("DISTRIBUTIVE_PROPERTY");
    // Must NOT leak root x = 7 or corrected step 3x + 12 on Hint L1
    expect(turn1.tutorMessage.toLowerCase()).not.toContain("x = 7");
    expect(turn1.tutorMessage.toLowerCase()).not.toContain("3x + 12");
    state = turn1.nextFsmState;

    // Turn 2: Student corrects bracket expansion "3x + 12 = 2x + 19"
    const turn2 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "3x + 12 = 2x + 19",
    });

    expect(turn2.stepStatus).toBe("CORRECT_INTERMEDIATE");
    expect(turn2.nextFsmState.phase).toBe("SOLVING");
    expect(turn2.nextFsmState.hintLevel).toBe(0);
    expect(turn2.nextFsmState.hadMistakeInProblem).toBe(true);
    state = turn2.nextFsmState;

    // Turn 3: Student solves "x = 7" -> Because they had an earlier mistake, FSM MUST transition to REINFORCEMENT and generate a similar problem!
    const turn3 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "x = 7",
    });

    expect(turn3.stepStatus).toBe("CORRECT_FINAL");
    expect(turn3.nextFsmState.phase).toBe("REINFORCEMENT");
    expect(turn3.followUpProblem).toBeDefined();
    expect(turn3.followUpProblem?.isReinforcement).toBe(true);
    expect(turn3.followUpProblem?.equation).not.toBe(problem.equation);

    // Turn 4: Student solves the reinforcement problem cleanly -> MASTERED!
    const followUp = turn3.followUpProblem!;
    const followUpState = createInitialFSMState(followUp);
    const turn4 = await runTutorHarnessTurn({
      problem: followUp,
      fsmState: followUpState,
      studentMessage: `x = ${followUp.expectedRoot}`,
    });

    expect(turn4.nextFsmState.phase).toBe("MASTERED");
    expect(turn4.stepStatus).toBe("CORRECT_FINAL");
  });

  it("4. Socratic Escalation & Worked Example Escape Hatch after 3 failed attempts", async () => {
    const problem = getTestScenarioProblem();
    let state = createInitialFSMState(problem);

    // Attempt 1 -> Hint L1
    const t1 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "3x + 4 = 2x + 19",
    });
    expect(t1.nextFsmState.phase).toBe("SOCRATIC_GUIDE");
    expect(t1.nextFsmState.hintLevel).toBe(1);
    state = t1.nextFsmState;

    // Attempt 2 (begging for answer) -> Hint L2, still refuses to leak
    const t2 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "Та просто скажи мені відповідь!",
    });
    expect(t2.nextFsmState.phase).toBe("SOCRATIC_GUIDE");
    expect(t2.nextFsmState.hintLevel).toBe(2);
    expect(t2.tutorMessage.toLowerCase()).not.toContain("x = 7");
    state = t2.nextFsmState;

    // Attempt 3 -> Hint L3
    const t3 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "3x + 8 = 2x + 19",
    });
    expect(t3.nextFsmState.phase).toBe("SOCRATIC_GUIDE");
    expect(t3.nextFsmState.hintLevel).toBe(3);
    state = t3.nextFsmState;

    // Attempt 4 -> Exceeds 3 Socratic attempts -> WORKED_EXAMPLE + Follow-Up Reinforcement Problem
    const t4 = await runTutorHarnessTurn({
      problem,
      fsmState: state,
      studentMessage: "все одно не виходить, 3x + 1 = 2x + 19",
    });
    expect(t4.nextFsmState.phase).toBe("WORKED_EXAMPLE");
    expect(t4.nextFsmState.wasAssisted).toBe(true);
    expect(t4.stepStatus).toBe("WORKED_EXAMPLE_GIVEN");
    expect(t4.followUpProblem).toBeDefined();
  });

  it("5. LeakageGate intercepts premature root leakage from an unconstrained LLM output", () => {
    const problem = getTestScenarioProblem();
    const verification = verifyStudentStep(
      "3x + 4 = 2x + 19",
      problem.equation,
      problem.expectedRoot
    );

    const leakyCandidate =
      "Ти забув помножити 3 на 4, має бути 3x + 12 = 2x + 19, отже x = 7.";

    const gateResult = enforceLeakageGate(
      leakyCandidate,
      problem,
      verification,
      "SOCRATIC_GUIDE",
      1,
      "DISTRIBUTIVE_PROPERTY"
    );

    expect(gateResult.trace.intercepted).toBe(true);
    expect(gateResult.trace.leakedTokens.length).toBeGreaterThan(0);
    expect(gateResult.safeResponse.toLowerCase()).not.toContain("x = 7");
  });

  it("6. Isomorphic Problem Generator produces CAS-verified integer-root equations", () => {
    const problem = getTestScenarioProblem();
    for (let i = 0; i < 4; i++) {
      const generated = generateIsomorphicProblem(
        problem,
        "DISTRIBUTIVE_PROPERTY",
        i
      );
      expect(Number.isInteger(generated.expectedRoot)).toBe(true);
      const check = verifyStudentStep(
        `x = ${generated.expectedRoot}`,
        generated.equation,
        generated.expectedRoot
      );
      expect(check.isEquivalentToTarget).toBe(true);
      expect(check.isFinalSolvedStep).toBe(true);
    }
  });
});
