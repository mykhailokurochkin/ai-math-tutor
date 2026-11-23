# AI Math Tutor

An interactive AI mathematics tutor inspired by the classical USSR algebra curriculum. Built as a TypeScript monorepo with **Next.js**, **LangGraph (`@langchain/langgraph`)**, **CortexJS Compute Engine**, **KaTeX**, and **Vercel AI SDK**.

- **Live Demo:** [https://ai-math-tutor-sable.vercel.app](https://ai-math-tutor-sable.vercel.app)
- **Cross-Platform Scaling Plan (Web, iOS, Android):** [`docs/SCALING_ARCHITECTURE.md`](./docs/SCALING_ARCHITECTURE.md)

---

## 1. Overview & Architecture

Pure LLM chat wrappers often hallucinate intermediate algebraic steps or give away the final solution as soon as a student asks for it. This project solves that by combining a **deterministic symbolic math engine** with a **LangGraph pedagogical state machine** inside a shared package (`packages/tutor-harness`).

Every student message flows through a compiled **LangGraph `StateGraph`** with 7 nodes:

```text
normalize_input ──► symbolic_cas_verify ──► pedagogical_fsm
                                                  │
       ┌── (if error was fixed & solved) ─────────┴── (normal turn) ──┐
       ▼                                                              ▼
generate_followup_problem ────────────────────────────► prepare_pedagogical_context
                                                                      │
                                                                      ▼
                                                             llm_socratic_tutor
                                                                      │
                                                                      ▼
                                                             socragate_guardrail
```

---

## 2. How Steps Are Parsed, Verified, and Recorded

Students interact through a **single unified chat input** on the right, while algebraic steps are automatically tracked on the **Solution Board** on the left:

1. **Hybrid Input Parsing (`normalizer.ts`):**
   - Extracts mathematical equations from both pure formula input (`3x + 12 = 2x + 19`) and natural sentences (*"I expanded the brackets and got 3x + 4 = 2x + 19"*).
   - Conversational messages without an equation (e.g., *"Can you give me a hint?"* or answering a sub-question like *"12"*) are handled as dialogue turns in chat without adding a fake step to the board.
2. **Symbolic Verification & Error Taxonomy (`verifier.ts`):**
   - Evaluates the left-hand side (LHS) and right-hand side (RHS) of the student's equation into canonical linear polynomials ($Ax + B$) using `@cortex-js/compute-engine` and compares roots against the target equation.
   - Each submitted equation is recorded on the Solution Board with one of four statuses:
     - **`Valid Step`**: Algebraically equivalent intermediate step (e.g., `3x + 12 = 2x + 19`).
     - **`Solved`**: Final isolated root (e.g., `x = 7`).
     - **`Needs Adjustment`**: Non-equivalent step. The verifier deterministically classifies the reasoning error into:
       - `DISTRIBUTIVE_PROPERTY` (e.g., `3(x + 4)` expanded to `3x + 4` instead of `3x + 12`)
       - `SIGN_FLIP_OR_TRANSPOSITION` (moving a term across `=` without reversing its sign)
       - `COMBINE_LIKE_TERMS` (arithmetic error when grouping $x$-terms or constants)
       - `DIVISION_OR_ISOLATION` (error in final division to isolate $x$)
     - **`Worked Explanation`**: Step breakdown provided by the tutor after failed attempts.
3. **Interactive Step Insights:**
   - Clicking any recorded step (`#1`, `#2`, `#3`...) on the Solution Board expands an insight panel explaining **what transformation was performed** (or why it needed adjustment) along with the **Tutor's Note** for that specific step.

---

## 3. Adaptive Hint Logic, Guardrails & Follow-Up Generation

Instead of leaving pedagogical decisions to an unconstrained prompt, the **Pedagogical Finite State Machine (`stateMachine.ts`)** controls how hints and explanations are delivered:

- **3-Level Progressive Socratic Scaffolding (`SOCRATIC_GUIDE`):**
  - **Hint Level 1 (Rule Prompt):** Triggered on the 1st error or hint request. Asks a conceptual question pointing to the mathematical rule (e.g., Distributive Property $a(b + c) = ab + ac$) without revealing the corrected equation.
  - **Hint Level 2 (Focused Term Check):** Triggered on the 2nd attempt. Directs the student's attention to the exact term or sign where the discrepancy occurred (e.g., *"You multiplied 3 by x, what happened to + 4?"*).
  - **Hint Level 3 (Atomic Micro-Step):** Triggered on the 3rd attempt. Prompts the student to calculate one atomic sub-step (e.g., $3 \times 4 = 12$) and rewrite the equation.
- **Answer-Leakage Guardrail (`leakageGate.ts`):**
  - Screens candidate LLM responses during `SOLVING` and `SOCRATIC_GUIDE` phases. If the student asks *"Just tell me the answer"* and the LLM attempts to reveal `x = 7` (or leaks `3x + 12` on Hint Level 1), the guardrail intercepts the response and replaces it with a safe Socratic question.
- **Worked Explanation Fallback (`WORKED_EXAMPLE`):**
  - To prevent student frustration, after at least 1 failed attempt a **"Show Worked Step Explanation"** button unlocks in the chat (and triggers automatically if the student fails more than 3 times on the same step). It walks through the exact step and marks the exercise as `Assisted`.
- **Mandatory Follow-Up Practice (`REINFORCEMENT` & `generator.ts`):**
  - If a student solves an equation without errors on the first try, the exercise immediately transitions to `MASTERED`.
  - If the student made an error (or used a worked explanation) along the way, solving `x = 7` transitions to `REINFORCEMENT`: the generator creates a new **CAS-verified similar problem** targeting the exact same skill (e.g., `4(x + 3) = 3x + 17`) so the student verifies understanding independently.

---

## 4. Progress, Topics & Exercise Management

- **Topic & Exercise Dropdowns:**
  - The curriculum is organized into 4 core algebra topics (**Distributive Property**, **Transposition & Signs**, **Combining Like Terms**, **Multi-Bracket Equations**), each pre-loaded with 4 exercises.
  - Inside the Exercise Dropdown, students can generate additional CAS-verified exercises (**`+ Generate 4 More Exercises`**), enter any custom linear equation (**`Or enter custom equation...`**), or delete generated exercises (which automatically removes them from statistics and recalculates progress).
- **Dynamic Mastery Calculation & History (`Progress` Modal):**
  - Topic mastery percentage is computed dynamically from the actual ratio of solved exercises to total exercises in that topic (`solvedCount / totalCount`, e.g., `2 / 4 = 50%`, `2 / 12 = 17%`).
  - **Exercise History Tab:** Saves the complete workspace state for every attempted exercise (all student steps, statuses, and tutor hints given) and allows reopening any past exercise with its full history restored.
  - **Mistakes Tab:** Tracks every diagnosed reasoning error (`Needs Correction` → `Corrected` → `Verified on Follow-Up`).

---

## 5. Two Interface Modes: `Student View` vs. `Reviewer View`

A segmented switcher in the top navigation bar lets you toggle between two modes:

1. **`Student View` (Default):**
   - Clean, distraction-free learning interface showing only the Solution Board, Topic/Exercise selectors, AI Tutor Chat, and Progress & History dashboard.
2. **`Reviewer View` (For Technical Evaluation):**
   - Unlocks the **Test Scenario Flow** toolbar at the top with 1-click sequential buttons to evaluate the assignment scenario in seconds:
     - `1. Inject Error: 3x + 4 = 2x + 19` (loads `3(x + 4) = 2x + 19` and submits the erroneous step)
     - `2. Fix Step: 3x + 12 = 2x + 19` (submits the corrected expansion)
     - `3. Solve: x = 7` (completes the problem and triggers follow-up problem generation)
     - `4. Solve Follow-Up` (solves the generated follow-up problem to verify mastery tracking)
   - Unlocks the collapsible **LangGraph Harness Inspector** console at the bottom, displaying the live executed LangGraph node path, symbolic CAS root & polynomial comparison (`Target x=7 vs Student x=15`), FSM state transition, and Leakage Guardrail status.

---

## 6. Running Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Configure LLM API key (optional — falls back to built-in symbolic guided engine if omitted)
cp .env.example apps/web/.env.local
# Set GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY

# 3. Run unit tests (Vitest)
pnpm test

# 4. Start development server
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## 7. Scaling to Web, iOS, and Android

The monorepo separates the pure-TypeScript AI and math core (`packages/tutor-harness`, ~80% of business logic, zero DOM dependencies) from the presentation layer (`apps/web`), allowing direct code sharing with an **Expo (React Native)** mobile app (`apps/mobile`) for iOS and Android.

See [**`docs/SCALING_ARCHITECTURE.md`**](./docs/SCALING_ARCHITECTURE.md) for the complete 3-week solo-engineer architecture covering native handwriting whiteboards (`@shopify/react-native-skia` + Vision OCR), voice tutoring pipelines, and offline state synchronization.
