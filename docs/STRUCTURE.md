# FinanceBuddy Project Structure

This document explains the purpose of every folder and key file in the FinanceBuddy monorepo.

## Root Files
- `package.json` — npm workspaces root configuration (`shared`, `server`, `client`) with unified scripts: `dev`, `build`, `start`, `seed`, `migrate`, and `test`.
- `tsconfig.base.json` — Shared strict TypeScript compiler options inherited across workspaces.
- `render.yaml` — Render deployment blueprint defining the Web Service and managed PostgreSQL database.
- `.env.example` — Template listing all required and optional environment variables (`DATABASE_URL`, `JWT_SECRET`, `AI_API_KEY`, etc.).
- `.gitignore` — Excludes `node_modules`, build `dist/` folders, `.env`, `uploads/`, and `_trash/`.
- `README.md` — Setup, demo accounts, architecture overview, and Render deployment instructions.

## Folders

### `client/`
React 18 + Vite + TypeScript + Tailwind CSS frontend (Midnight Aurora theme).
- `index.html` — Single HTML entry point for the SPA.
- `public/assets/` — Static images (`hero.jpg`, `leo.jpg`, `sarah.jpg`).
- `src/styles/globals.css` — 3-line Tailwind CSS entry point.
- `src/theme/` — Midnight Aurora design tokens (`tokens.ts`) and `ThemeProvider.tsx`.
- `src/lib/` — Frontend helpers (`api.ts` for typed API requests, `currency.ts` for `Intl.NumberFormat` formatting).
- `src/store/` — Zustand global state (`useStore.ts`).
- `src/components/` — Reusable UI, layout, navigation, and 3D components.
- `src/pages/` — Application pages (`LandingPage`, `LoginPage`, `RegisterPage`, `DashboardPage`, `GoalsPage`, `EmergencyPage`, `ChoresPage`, `FamilyManagePage`, `ApprovalsPage`, `LearningHubPage`, `TransactionsPage`, `AiCoachPage`, `SettingsPage`).
- `src/routes.tsx` — Centralized React Router route definitions and role guards.

### `server/`
Node.js + Express + TypeScript backend with Prisma ORM and PostgreSQL (plus an in-memory fallback for zero-config local testing).
- `prisma/schema.prisma` — Database schema (`User`, `Wallet`, `Plan`, `Goal`, `GoalDeposit`, `Chore`, `ChoreSubmission`, `Transaction`, `Request`, `Lesson`, `LessonProgress`, `Badge`, `Notification`). All monetary values are stored as integer cents/paise.
- `prisma/seed.ts` — CLI entry point for seeding demo accounts (`Sarah`, `Leo`, `Riya`, `Aman`).
- `src/config/index.ts` — Environment configuration and constants.
- `src/db.ts` — Database client wrapper supporting Prisma PostgreSQL and in-memory fallback.
- `src/middleware/` — JWT cookie auth (`auth.ts`), login rate limiting (`rateLimit.ts`), and Multer file upload handling (`upload.ts`).
- `src/routes/` — Modular Express routers (`auth`, `dashboard`, `children`, `wallet`, `goals`, `chores`, `requests`, `transactions`, `learning`, `ai`).
- `src/utils/` — Financial pacing calculators (`calculator.ts`) and pluggable file storage (`storage.ts`).
- `src/app.ts` — Express application setup, security headers (`helmet`), CORS, route mounting, and production static serving of `client/dist`.
- `src/server.ts` — HTTP server entry point.
- `tests/api.test.ts` — End-to-end API test suite covering all 3 account modes (Family, Myself, Teen/Student).

### `shared/`
Shared Zod validation schemas, TypeScript types, age-aware preset calculators, and currency/disclaimer constants consumed by both `client/` and `server/`.

### `docs/`
Project documentation, including this `STRUCTURE.md` file.

### `uploads/`
Local storage directory for uploaded receipt/chore proof files (gitignored; ephemeral on Render — replace `LocalStorageProvider` in `server/src/utils/storage.ts` with S3/Cloudinary for persistent production storage).

### `_trash/`
Safe quarantine folder holding duplicate, unused, and legacy HTML/CSS/backend files moved during repository cleanup. Gitignored and safe to delete once you have verified everything works.
