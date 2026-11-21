# AI Math Tutor — Neuro-Symbolic Pedagogical Harness

An interactive AI Mathematics Tutor inspired by the classical USSR mathematics education system (Kiselev / Makarychev / Skanavi methodology) and Google LearnLM pedagogical principles.

## Architecture Highlights

- **`packages/tutor-harness`**: Cross-platform Neuro-Symbolic AI Engine written in strict TypeScript (ready to share between Web and React Native / Expo for iOS & Android):
  - **Hybrid Input Normalizer**: Extracts algebraic equations from natural student dialogue and normalizes ASCII math to LaTeX.
  - **Deterministic Symbolic Math Verifier (`@cortex-js/compute-engine` + AST rules)**: Checks exact algebraic equivalence between steps, diagnoses LHS/RHS discrepancies, and classifies error taxonomy (`DISTRIBUTIVE_PROPERTY`, `SIGN_ERROR`, `COMBINE_LIKE_TERMS`, `ARITHMETIC_ERROR`) before calling the LLM.
  - **Pedagogical Finite State Machine (FSM)**: Strictly controls lesson flow (`SOLVING` → `SOCRATIC_GUIDE (L1..L3)` → `WORKED_EXAMPLE` fallback after 3 failed attempts → `REINFORCEMENT` → `MASTERED`).
  - **Isomorphic Problem Generator**: Dynamically generates follow-up problems targeting the student's exact misconception with CAS-verified integer roots.
  - **Output-Admission Guardrail (`LeakageGate`)**: Prevents the LLM from leaking final answers prematurely during Socratic guidance.
- **`apps/web`**: Next.js 15 App Router frontend with KaTeX formula rendering, Step-by-Step Notebook Workspace, Socratic Tutor Chat, 1-Click Role Switcher (`Tech Reviewer` vs `Student`), and live **AI Harness Inspector (Under the Hood)**.
- **`docs/SCALING_ARCHITECTURE.md`**: Blueprint for delivering Web, iOS, and Android apps in 3 weeks as a solo engineer.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm dev
```
