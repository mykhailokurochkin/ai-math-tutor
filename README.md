# AI Math Tutor

An interactive AI mathematics tutor inspired by the classical USSR algebra curriculum. Built as a TypeScript monorepo using **Next.js**, **LangGraph (`@langchain/langgraph`)**, **CortexJS Compute Engine**, **KaTeX**, and **Google Gemini (`gemini-3.5-flash-lite`)**.

- **Live Demo:** [https://ai-math-tutor-sable.vercel.app](https://ai-math-tutor-sable.vercel.app)
- **Scaling Plan (Web, iOS & Android):** [`docs/SCALING_ARCHITECTURE.md`](./docs/SCALING_ARCHITECTURE.md)

## Quick Summary

- **Neuro-Symbolic Verification:** Every student step is checked deterministically with `@cortex-js/compute-engine` before calling the LLM, eliminating math hallucinations.
- **Adaptive Socratic Teaching:** A LangGraph state machine escalates hints across 3 levels (`L1` → `L2` → `L3`), blocks premature answer leaks, and generates a similar follow-up problem after an error is corrected.
- **Two Modes:** Opens in **Student View** by default; switch to **Reviewer View** in the top bar to test the assignment scenario (`3(x + 4) = 2x + 19` → `3x + 4 = 2x + 19`) in a few clicks and view the live LangGraph trace.
- **Progress & Topics:** Includes 4 algebra topics, on-demand exercise generation (plus custom equations and deletion of generated items), **Reset**, and a **Progress & History** dashboard.

---

## 1. Architecture (`packages/tutor-harness`)

Instead of relying on a single LLM prompt, each turn runs through a compiled **LangGraph `StateGraph`**:

`normalize_input` → `symbolic_cas_verify` → `pedagogical_fsm` → *(conditional: `generate_followup_problem`)* → `prepare_pedagogical_context` → `llm_socratic_tutor` → `socragate_guardrail`.

The core logic lives in `packages/tutor-harness` with zero DOM dependencies so it can be shared directly between Web (`apps/web`) and future mobile apps (`Expo / React Native`).

---

## 2. How Steps & Adaptive Hints Work

- **Unified Input & Step Tracking:** Students write both equation steps (`3x + 12 = 2x + 19`) and questions in a single chat input. Mathematical equations are extracted automatically (`normalizer.ts`), verified symbolically (`verifier.ts`), and recorded on the left **Solution Board** as `Valid Step`, `Solved`, `Needs Adjustment`, or `Worked Explanation`.
- **Interactive Step Insights:** Clicking any recorded step on the Solution Board expands a short explanation of the transformation performed along with the tutor's note for that step.
- **Reasoning Error Diagnosis:** Non-equivalent steps are classified into concrete error types (`DISTRIBUTIVE_PROPERTY`, `SIGN_FLIP_OR_TRANSPOSITION`, `COMBINE_LIKE_TERMS`, `DIVISION_OR_ISOLATION`). On `3(x + 4) = 2x + 19` → `3x + 4 = 2x + 19`, the verifier detects that `3` was not multiplied by `4`.
- **3-Level Socratic Hints & Guardrail:**
  - **L1:** Conceptual prompt pointing to the mathematical rule (e.g., $a(b + c) = ab + ac$).
  - **L2:** Focused question isolating the exact term or sign that was missed.
  - **L3:** Atomic micro-step prompt to guide the final correction.
  - **Leakage Guardrail (`leakageGate.ts`):** Screens LLM output during active solving so the final root is never leaked prematurely—even if the student asks for the answer directly.
  - **Worked Explanation Fallback:** Unlocks after at least one failed attempt (or automatically after 3 failed attempts) so students never get stuck indefinitely.
- **Follow-Up Practice:** Whenever a student fixes a mistake (or uses a worked explanation) and finishes an equation, the system dynamically generates a CAS-verified similar equation with an integer root to confirm independent understanding.

---

## 3. Two Interface Modes

- **`Student View` (Default):** Clean learning workspace with paired **Topic** and **Exercise** dropdowns (4 topics, `+ Generate 4 More Exercises`, custom equation input, delete option for generated exercises), Solution Board, AI Tutor Chat, and **Progress & History** modal (`Topics`, `Exercise History`, `Mistakes`).
- **`Reviewer View`:** Adds a top **Test Scenario Flow** bar with sequential 1-click buttons (`1. Inject Error: 3x + 4 = 2x + 19` → `2. Fix Step: 3x + 12 = 2x + 19` → `3. Solve: x = 7` → `4. Solve Follow-Up`) and a collapsible **LangGraph Harness Inspector** showing the live node path, CAS polynomial comparison, FSM state, and guardrail check.

---

## 4. Running Locally

```bash
pnpm install
cp .env.example apps/web/.env.local   # Add GOOGLE_GENERATIVE_AI_API_KEY (optional: includes symbolic fallback)
pnpm test                              # Run Vitest suite for @ai-math-tutor/tutor-harness
pnpm dev                               # Start Next.js at http://localhost:3000
```
