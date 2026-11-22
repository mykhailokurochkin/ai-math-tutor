# Scaling Architecture: Web, iOS, and Android (Solo Engineer · 3-Week MVP Blueprint)

This document outlines the architectural strategy for scaling **AI Math Tutor** from this web prototype to a unified production platform across **Web, iOS, and Android** within a **3-week timeline by a single engineer**.

---

## 1. Core Strategy: Monorepo with Shared TypeScript AI & Domain Core

To deliver and maintain three platforms as a solo engineer without tripling the engineering workload, the system is architected as a **pnpm Workspace Monorepo** where **~80% of the code** (pedagogical harness, symbolic math verification, state machine, API types, and curriculum data) lives in shared, platform-agnostic packages:

```text
ai-math-tutor/
├── packages/
│   ├── tutor-harness/       # Shared Neuro-Symbolic Engine (CAS Verifier, Pedagogical FSM, Guardrails)
│   ├── curriculum/          # USSR Mathematics Curriculum Graph (Grades 5-11 + Skanavi Olympiad Track)
│   └── api-client/          # Typed RPC / Streaming Hooks shared by Web & Mobile
├── apps/
│   ├── web/                 # Next.js 15 (Web App, Parent Dashboard, API Backend)
│   └── mobile/              # Expo (React Native) targeting iOS & Android from a single codebase
```

### Why This Works for a Solo Developer:
- **Zero Duplication of Math/Pedagogy Logic:** `@cortex-js/compute-engine`, the input normalizer, the Pedagogical FSM, and the problem generator are written in pure TypeScript with zero DOM dependencies. They run identically inside Next.js API routes, Web Workers, and React Native (JavaScriptCore / Hermes).
- **Single Backend Surface:** `apps/web` (or a dedicated Hono/FastAPI service) exposes stateless streaming endpoints (`/api/tutor/step`, `/api/voice`, `/api/vision`) consumed by Web, iOS, and Android clients alike.

---

## 2. Cross-Platform Feature Implementation Matrix

| Feature | Web (`apps/web` · Next.js) | iOS & Android (`apps/mobile` · Expo) | Shared Core (`packages/*`) |
| :--- | :--- | :--- | :--- |
| **Math Rendering** | `KaTeX` (SSR + CSR) | `react-native-math-view` / WebView KaTeX | Canonical LaTeX AST via `normalizer.ts` |
| **Interactive Math Input** | Custom Step Input / `MathLive` | Custom Native Math Keyboard Sheet | `extractEquationFromText()` & `asciiToLatex()` |
| **Handwriting Whiteboard** | HTML5 Pointer Canvas | `@shopify/react-native-skia` + `react-native-gesture-handler` | Stroke serializer + Vision OCR (`Gemini 2.5 Flash` / `Mathpix`) |
| **Voice Conversations** | Web Speech API / WebRTC | `expo-av` / LiveKit WebRTC | Multimodal Realtime Voice Session Manager |
| **Offline & State Sync** | IndexedDB / Optimistic UI | `expo-sqlite` + TanStack Query | Shared Zod Schemas & Sync Queue |
| **Auth & Cloud DB** | Supabase Auth + PostgreSQL (Drizzle) | Supabase Auth (`expo-secure-store`) | Row-Level Security (Student vs. Parent views) |

---

## 3. Key Subsystems for the Full Product Vision

### A. Interactive Handwriting Whiteboard (iPad Pencil, Android Stylus, Web)
- **Rendering Layer:** Using **`@shopify/react-native-skia`**, the same declarative `<Canvas>` and `<Path>` drawing code runs at 60–120fps on iOS (Metal), Android (Vulkan/OpenGL), and Web (CanvasKit WASM).
- **Math OCR Pipeline:**
  1. Student writes a solution step on the canvas.
  2. When the student pauses or taps *"Check Step"*, the canvas exports a lightweight bounding-box PNG snapshot (`makeImageSnapshot()`).
  3. A multimodal vision endpoint (**Gemini 2.5 Flash Vision** or **Mathpix API**) converts the handwritten step into normalized LaTeX (`3x + 4 = 2x + 19`).
  4. The LaTeX is passed directly into `runTutorHarnessTurn()` in `@ai-math-tutor/tutor-harness` for deterministic symbolic verification.

### B. Low-Latency Voice + Text Tutoring
- **Text Mode:** Standard HTTP/SSE streaming through the Neuro-Symbolic Pedagogical Harness.
- **Voice Mode:**
  - **STT (Speech-to-Text):** Browser Web Speech API / Whisper API converts spoken math (*"three x plus four equals two x plus nineteen"*) into text, which `normalizer.ts` parses into `3x + 4 = 2x + 19`.
  - **TTS (Text-to-Speech):** The tutor's Socratic response is converted from LaTeX-annotated text into natural spoken math strings before streaming audio back to the student.

### C. Adaptive USSR Curriculum & Olympiad Track
- **Knowledge Graph:** Topics are modeled as a Directed Acyclic Graph (DAG) following the classical Soviet progression (Kiselev *Arithmetic & Algebra*, Makarychev *Grades 7–9*, Kolmogorov *Grades 10–11*, and Skanavi *Olympiad Collection*).
- **Mastery Progression:** A node only transitions to `MASTERED` when the student solves exercises without assistance—or, if an error occurred, solves a dynamically generated **isomorphic reinforcement problem** independently.

---

## 4. Realistic 3-Week Delivery Roadmap (Solo Engineer)

### Week 1: Core Engine, Database & Web MVP
- **Days 1–3:** Finalize `@ai-math-tutor/tutor-harness` (Symbolic CAS verifier, Pedagogical FSM, Socratic Guardrails, Isomorphic Problem Generator) + PostgreSQL/Supabase schema (Students, Parents, Sessions, Mistakes, Curriculum Graph).
- **Days 4–7:** Build and deploy the complete Web application (`apps/web`) including Step-by-Step Workspace, Socratic Chat, Interactive Whiteboard (Canvas + Vision OCR), and Parent/Student Progress Dashboard.

### Week 2: iOS & Android App via Expo (`apps/mobile`)
- **Days 8–10:** Initialize `apps/mobile` with **Expo Router**, consuming `@ai-math-tutor/tutor-harness` and `@ai-math-tutor/api-client`. Implement responsive tablet/phone layouts for the Math Notebook and Tutor Chat.
- **Days 11–14:** Integrate `@shopify/react-native-skia` for native stylus/touch handwriting whiteboard and `expo-speech` / Whisper for voice interaction.

### Week 3: Polish, Cross-Platform QA & App Store / Play Store Deployment
- **Days 15–17:** Expand curriculum problem templates (Grades 5–9 + Olympiad challenges), add parent progress alerts and assessment mode.
- **Days 18–21:** Automated E2E verification, **EAS Build & EAS Submit** for TestFlight (iOS) and Google Play Internal/Production track (Android), plus Vercel production deployment for Web.
