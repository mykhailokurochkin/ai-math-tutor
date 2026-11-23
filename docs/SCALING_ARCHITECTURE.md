# Scaling Plan: From Prototype to Production Platform (Web, iOS & Android)

## Overall Scaling Directions (Summary)

- **Platforms:** Shared TypeScript monorepo (`Next.js` for Web + `Expo / React Native` for iOS & Android).
- **Core Input Modes:** Text + LaTeX → Handwriting Whiteboard (`Skia` + Vision OCR) → Voice Conversations.
- **Infrastructure:** Local JSON prototype → `PostgreSQL / Supabase` + Auth + Student/Parent/Teacher roles.
- **Content Creation:** AI-assisted Curriculum Builder allowing teachers, directors, or learners to upload materials and auto-generate new modules.
- **Subject Expansion:** Algebra → Geometry (interactive diagrams & proofs) → Olympiad & Competition tracks.
- **Monetization:** Freemium subscriptions and family/school plans via **Stripe** (Web) and **RevenueCat** (iOS/Android).

---

## 1. Cross-Platform Architecture (Web, iOS & Android by One Engineer)

Maintaining three separate codebases is unrealistic for a solo developer on a tight timeline. To keep development fast and maintainable, the project is already structured as a **pnpm monorepo** with a shared TypeScript core:

- **Shared Core (`packages/tutor-harness`):** Contains the LangGraph state machine, symbolic math verifier, problem generator, and types. It has zero browser/DOM dependencies and runs identically on Web and mobile.
- **Single Backend API:** Both Web and mobile clients talk to the same backend endpoints (`/api/tutor/step`, `/api/problems`, `/api/progress`) backed by **PostgreSQL (Supabase)** with role-based access for students, parents, and teachers.
- **Web (`apps/web`):** Next.js 15 with KaTeX rendering, HTML5 Canvas whiteboard, and parent/teacher dashboards.
- **iOS & Android (`apps/mobile`):** Built with **Expo (React Native)** so one mobile codebase compiles natively for both App Store and Google Play via **EAS Build**, reusing the shared types and API client.

### Core Platform Capabilities
- **Interactive Handwriting Whiteboard:** Use **`@shopify/react-native-skia`** on iOS/Android (and HTML5 Canvas on Web) for smooth finger/stylus drawing. When the student finishes writing a step, a snapshot is sent to **Gemini Vision** (or **Mathpix**) to convert handwriting into LaTeX, which feeds directly into the existing LangGraph verifier.
- **Voice Tutoring:** Add Speech-to-Text (Whisper / Web Speech API) and Text-to-Speech (or Realtime Voice APIs) on top of the existing tutor loop so students can talk through problems naturally.

---

## 2. Realistic 3-Week MVP Delivery Plan

- **Week 1 — Backend, Auth & Full Web App:** Migrate storage to PostgreSQL (Supabase), add authentication and Student/Parent roles, and ship the complete Web version with handwriting canvas and progress tracking.
- **Week 2 — Mobile App (iOS & Android):** Spin up `apps/mobile` with Expo Router sharing the same backend and harness, then integrate the Skia handwriting whiteboard and voice input/output.
- **Week 3 — Polish, QA & Store Releases:** Expand the core algebra curriculum, test cross-platform edge cases, and deploy to **Vercel** (Web), **TestFlight** (iOS), and **Google Play** (Android).

---

## 3. Product & Business Scaling Directions

### A. AI Curriculum Authoring Tool (Teachers, Directors & Self-Learners)
Instead of hardcoding every lesson manually, the platform can include a dedicated **Curriculum Builder** for teachers, school directors, or advanced self-learners. They upload textbook chapters, PDFs, or problem sets, and an AI ingestion agent parses the material, extracts the rules, generates CAS-verified exercise templates, and publishes a ready-to-use interactive module directly to the platform.

### B. Expanding Beyond Algebra: Geometry & Visual Math
Algebra relies primarily on symbolic equations, whereas **Geometry** is a distinct visual domain. Scaling into geometry means adding an interactive geometric canvas (built on Skia/SVG) where students can construct shapes, label angles, and write multi-step proofs—while a multimodal agent verifies both the diagram and the logical reasoning behind each theorem.

### C. Monetization, Subscriptions & Billing
To turn the platform into a sustainable product:
- **Pricing Tiers:** Free tier (limited daily sessions) → **Student / Family Subscription** (unlimited AI tutoring, voice mode, handwriting whiteboard, parent progress reports) → **School / B2B Licenses** (teacher authoring tools and class analytics).
- **Payment Infrastructure:** **Stripe** for Web subscriptions and B2B billing, paired with **RevenueCat** to manage iOS App Store and Google Play in-app subscriptions from a single unified backend webhook.
