# AI Math Tutor

An interactive AI mathematics tutor inspired by the classical USSR algebra curriculum. Built with **Next.js**, **LangGraph (`@langchain/langgraph`)**, **CortexJS Compute Engine**, and **Vercel AI SDK**.

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure API key (optional — includes a built-in symbolic fallback engine)
cp .env.example apps/web/.env.local
# Add GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY

# 3. Run unit tests
pnpm test

# 4. Start development server
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## Technical Approach

Standard LLM wrappers often hallucinate algebraic steps or give away answers prematurely when a student asks for the solution. To solve this, the project separates deterministic math verification from conversational tutoring inside a shared monorepo package (`packages/tutor-harness`):

1. **LangGraph Orchestration (`StateGraph`):**
   Every turn flows through a structured graph:
   `normalize_input` → `symbolic_cas_verify` → `pedagogical_fsm` → *(conditional: `generate_followup_problem`)* → `prepare_pedagogical_context` → `llm_socratic_tutor` → `socragate_guardrail`.
2. **Symbolic Error Detection (`@cortex-js/compute-engine`):**
   Before calling the LLM, the verifier expands and compares the left and right sides of the student's equation against the target equation. It deterministically classifies mistakes (`DISTRIBUTIVE_PROPERTY`, `SIGN_FLIP_OR_TRANSPOSITION`, `COMBINE_LIKE_TERMS`, `DIVISION_OR_ISOLATION`).
3. **Adaptive Socratic Teaching & Answer-Leakage Guardrail:**
   Instead of revealing the final root, the tutor guides the student through 3 progressive hint levels (`L1: Rule Prompt` → `L2: Term Focus` → `L3: Atomic Step`). An output guardrail blocks premature answer leaks. If a student is still stuck after attempting, a *"Show Worked Step Explanation"* option unlocks.
4. **Dynamic Practice Generation:**
   When a student corrects a mistake and solves the equation, the generator creates a similar problem targeting the same mathematical property and verifies via CAS that it has a clean integer root.
5. **Progress & Solution History:**
   Tracks mastery across topics, logs diagnosed reasoning mistakes, and saves the step-by-step solution and hint history for every attempted exercise.

---

## Testing the Assignment Scenario

**Scenario:** Solving `3(x + 4) = 2x + 19` where the student incorrectly writes `3x + 4 = 2x + 19`.

- **In Student View (Default):**
  Type `3x + 4 = 2x + 19` in the chat. The tutor detects that `3` was not multiplied by `4`, highlights the reasoning error on the solution board, and asks a guiding question without revealing `x = 7`.
- **In Reviewer View (1-Click Demo):**
  Switch to **Reviewer View** in the top bar and click **`1. Run Test Scenario: 3(x + 4) = 2x + 19 → 3x + 4 = 2x + 19`**, followed by steps `2` and `3` to test error correction and follow-up problem generation in seconds.

---

## Scaling to Web, iOS, and Android

The repository is structured as a **pnpm monorepo** to allow a single engineer to deliver and maintain **Web, iOS, and Android** from one shared TypeScript core:

- **`packages/tutor-harness` (Shared Core — ~80% of logic):** Pure TypeScript with zero DOM dependencies. Runs identically in Next.js and React Native (Expo).
- **`apps/web` (Next.js 15):** Web interface with KaTeX rendering and API endpoints.
- **`apps/mobile` (Expo / React Native — Mobile Target):** Reuses `packages/tutor-harness`, adding `@shopify/react-native-skia` for native stylus/touch handwriting whiteboards (paired with Vision OCR) and WebRTC / Speech APIs for voice tutoring.

For the full 3-week cross-platform implementation plan, see [**`docs/SCALING_ARCHITECTURE.md`**](./docs/SCALING_ARCHITECTURE.md).
