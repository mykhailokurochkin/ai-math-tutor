# AI Math Tutor — Neuro-Symbolic Pedagogical Prototype

A functional prototype of an interactive AI mathematics tutor inspired by the **classical USSR mathematics education system** (Kiselev / Makarychev / Skanavi methodology) and Google LearnLM active-learning principles.

Built as a **TypeScript Monorepo** separating the cross-platform AI pedagogical engine (`packages/tutor-harness`) from the web application (`apps/web`).

---

## 1. Technical Approach: Why a Neuro-Symbolic Pedagogical Harness?

Most LLM-based math tutors rely on a single system prompt (*"You are a math tutor, don't give away the answer"*). In practice, pure prompt-wrappers fail in three critical ways:
1. **Mathematical Hallucinations:** LLMs frequently miscalculate intermediate algebraic steps or misidentify where a student went wrong.
2. **The Compliance Trap (Answer Leakage):** When an impatient student asks *"Just tell me the answer"*, instruction-tuned models routinely leak the solution.
3. **Lack of Structured Pedagogical Control:** Pure chat models do not deterministically enforce follow-up verification problems after a misconception is fixed.

### Our Solution: `@ai-math-tutor/tutor-harness`

Instead of a thin API wrapper, this project implements a **Neuro-Symbolic Pedagogical Harness** that combines deterministic Computer Algebra System (CAS) verification with an explicit Pedagogical Finite State Machine (FSM):

```text
Student Input ("3x + 4 = 2x + 19")
   │
   ▼
1. Hybrid Input Normalizer (normalizer.ts)
   Extracts equations from natural chat & normalizes ASCII math to LaTeX
   │
   ▼
2. Symbolic CAS Math Verifier (verifier.ts · @cortex-js/compute-engine)
   Evaluates LHS/RHS linear polynomials, checks exact root equivalence (x=15 vs x=7),
   and diagnoses the exact reasoning error: DISTRIBUTIVE_PROPERTY (3x + 4 != 3x + 12)
   │
   ▼
3. Pedagogical Finite State Machine (stateMachine.ts)
   Controls transitions: SOLVING ──► SOCRATIC_GUIDE (Hint L1 → L2 → L3)
                                 ──► WORKED_EXAMPLE (Fallback after 3 failed attempts)
                                 ──► REINFORCEMENT (Mandatory follow-up problem after an error)
                                 ──► MASTERED
   │
   ▼
4. Isomorphic Problem Generator (generator.ts)
   When an error is corrected and solved, generates a similar problem targeting
   the exact same rule (e.g. 4(x + 3) = 3x + 17) and verifies via CAS that its root is an integer
   │
   ▼
5. LLM Generation + Output-Admission Guardrail (provider.ts + leakageGate.ts)
   Injects the verified CAS scratchpad into the LLM prompt (Gemini / OpenAI / Anthropic)
   and screens the generated response to block premature answer leakage.
```

---

## 2. How Each Requirement is Satisfied

| Requirement | Implementation |
| :--- | :--- |
| **1. AI Tutor Interface** | Apple-clean split-screen workspace (`apps/web`): **Step-by-Step Math Workspace** with publication-grade **KaTeX** rendering on the left, and **Adaptive Socratic Chat** on the right. |
| **2. Error Detection** | `verifyStudentStep()` in [`verifier.ts`](./packages/tutor-harness/src/math/verifier.ts) compares the student's step against the reference equation symbolically. On `3(x + 4) = 2x + 19` → `3x + 4 = 2x + 19`, it identifies `DISTRIBUTIVE_PROPERTY` (`LHS expanded to 3x + 4 instead of 3x + 12; constant term 4 was not multiplied by 3`). |
| **3. Adaptive Teaching** | `computeFSMTransition()` in [`stateMachine.ts`](./packages/tutor-harness/src/fsm/stateMachine.ts) escalates Socratic hints across 3 levels (`L1: Conceptual Rule` → `L2: Focused Term Check` → `L3: Atomic Sub-Step`) while [`leakageGate.ts`](./packages/tutor-harness/src/guardrails/leakageGate.ts) blocks premature answer leaks. After 3 failed attempts (or via the unlocked *"Show Worked Step Explanation"* button), it provides a full worked explanation (`WORKED_EXAMPLE`). |
| **4. Personalized Practice** | `generateIsomorphicProblem()` in [`generator.ts`](./packages/tutor-harness/src/math/generator.ts) automatically triggers when a student solves an equation after making an error, generating a CAS-verified similar equation (e.g., `4(x + 3) = 3x + 17`) to confirm independent mastery. |
| **5. Progress Tracking** | Persistent store ([`store.ts`](./apps/web/src/lib/store.ts)) and **Progress Dashboard Modal** ([`ProgressModal.tsx`](./apps/web/src/components/ProgressModal.tsx)) tracking completed exercises, topic mastery percentages, and a detailed **Diagnosed Reasoning Mistakes Log** (`Needs Correction` → `Corrected` → `Verified by Follow-Up`). |

---

## 3. Built-In Reviewer Experience (`Reviewer View` vs `Student View`)

The top navigation bar features a 1-click **Role Switcher**:
- **Reviewer View (Default):**
  - Displays the **Test Scenario Controls** bar at the top: click **`1. Run Test Scenario: 3(x + 4) = 2x + 19 → 3x + 4 = 2x + 19`** to immediately load the test problem and submit the erroneous step in one click, followed by quick-action buttons (`2. Correct Error: 3x + 12 = 2x + 19` and `3. Solve: x = 7 (→ Generate Follow-Up)`).
  - Displays the live **AI Harness Inspector (Neuro-Symbolic Telemetry)** console at the bottom, showing real-time CAS root comparison, LHS/RHS polynomial diff, FSM state transitions, and Leakage Guardrail status.
- **Student View (`Alex K.`):**
  - Hides all developer/reviewer toolbars to showcase the distraction-free student learning experience.

---

## 4. Getting Started Locally

### Prerequisites
- Node.js `>= 20.0.0`
- `pnpm`

### Installation & Running

```bash
# 1. Install dependencies across the monorepo
pnpm install

# 2. (Optional) Configure your LLM API key
cp .env.example .env
# Set GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env
# Note: The prototype also includes a deterministic Neuro-Symbolic Guided Engine
# fallback so it runs out-of-the-box even before an API key is added.

# 3. Run the unit test suite for the Neuro-Symbolic Harness
pnpm test

# 4. Start the Next.js development server
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## 5. Scaling to Web, iOS, and Android

See [**`docs/SCALING_ARCHITECTURE.md`**](./docs/SCALING_ARCHITECTURE.md) for the complete architectural blueprint detailing how this monorepo scales to **Web, iOS, and Android** using **Expo (React Native)**, **`@shopify/react-native-skia`** for the handwriting whiteboard, Vision OCR, and Voice conversation pipelines within a 3-week solo-engineer timeline.
