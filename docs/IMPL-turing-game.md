# Implementation Plan — Turing Game MVP
> Status: TEMPLATE · Version: 0.1 · Last updated: {{DATE}}

---

## Overview

Single Next.js 14 app (App Router). Deployed on Vercel free tier. Real-time state via Supabase. Claude invoked via Vercel AI SDK + Anthropic provider on an Edge API route. No monorepo, no separate backend service.

**Estimated total build time:** 3–4 focused days for two developers.

---
## NOT to forget
- pnpm, NOT npm is used for dependencies. (update and adapt this doc for any future mention of npm).

---
## Phase 0 — Environment & Tooling Setup
> **Detail level: HIGH.** Do this exactly once, together, before writing any product code.

### 0.1 Vercel Account & CLI [DONE]

**Create the account:**
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub. Use the same GitHub account that will own the repo. This links them automatically.
2. Select the **Hobby** plan (free). No credit card required.
3. Skip the onboarding project wizard for now — you'll create the project from the CLI.

**Install the Vercel CLI:**
```bash
npm install -g vercel
```
Verify:
```bash
vercel --version
# Should output: Vercel CLI X.X.X
```

**Authenticate the CLI:**
```bash
vercel login
# Choose "Continue with GitHub"
# A browser window opens — authorize it
```

You do not need the CLI for day-to-day development but it is useful for environment variable management and manual deploys. Once the GitHub repo is connected to Vercel, every push to `main` deploys automatically without the CLI.

### 0.2 Repository Setup

**Recommended flow — create from GitHub, connect to Vercel:**

1. On GitHub, create a new **empty** repository named `turing-game` (private or public, your choice). [DONE]
2. Clone it locally: [DONE]
```bash
git clone https://github.com/YOUR_ORG/turing-game.git
cd turing-game 
```
3. Scaffold a Next.js app inside it:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
# "." installs into current directory (the cloned repo)
```
4. Accept all defaults. This generates the standard Next.js 14 App Router structure.
5. Push the scaffold to GitHub:
```bash
git add .
git commit -m "chore: scaffold next.js app"
git push origin main
```
6. Go to [vercel.com/new](https://vercel.com/new), click **"Import Git Repository"**, select `turing-game`. Vercel auto-detects Next.js. Click **Deploy**. First deploy will succeed with the placeholder homepage.

From this point forward, every push to `main` triggers a production deploy. Every pull request gets its own **preview URL** automatically — this is Vercel's killer feature for testing.

> **Do not use Turborepo.** It is a monorepo tool for multiple packages. This project is a single app. Adding Turborepo here creates overhead with no benefit.

### 0.3 Project Structure

After scaffolding, your `/src` directory should be organized as follows. Create these directories now — most will be empty until later phases.

```
src/
├── app/
│   ├── page.tsx                  # Home — Create Game CTA
│   ├── game/[gameId]/page.tsx    # P1 game screen
│   ├── join/[gameId]/page.tsx    # P2 join + witness screen
│   └── api/
│       ├── create-game/route.ts  # POST: create game row in Supabase
│       ├── claude-message/route.ts  # POST: invoke Claude, stream response
│       └── end-game/route.ts     # POST: record guess, trigger result
├── components/
│   ├── ChatPanel.tsx
│   ├── GuessDropdown.tsx
│   ├── CountdownTimer.tsx
│   └── ResultOverlay.tsx
├── lib/
│   ├── supabase.ts               # Supabase client singleton
│   ├── claude.ts                 # Claude invocation helper
│   └── game.ts                   # Shared game logic utilities
└── agent-skills/                 # MD files injected into Claude system prompt
    ├── persona.md
    ├── typo-engine.md
    ├── pacing.md
    └── result-reflection.md
```

> `agent-skills/` lives inside `src/` so it's bundled with the server-side code. These files are never exposed to the browser.

### 0.4 Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Create a new project — name it `turing-game`, choose the region closest to your Vercel deployment region (US East or EU West).
3. Wait ~2 minutes for provisioning.
4. Go to **Table Editor** and create the two tables from the schema in the PRD (`games` and `messages`). Alternatively, go to **SQL Editor** and run the migration SQL (you'll write this in Phase 1).
5. Go to **Project Settings → API**. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose to browser)
6. Enable **Realtime** for the `messages` table: go to **Database → Replication** and toggle `messages` on.

### 0.5 Environment Variables

**Local (`.env.local`)** — create this file at the repo root, add to `.gitignore` immediately:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

**Vercel (production + previews):**
In the Vercel dashboard → your project → **Settings → Environment Variables**, add all four. Set them for **Production**, **Preview**, and **Development** environments.

Alternatively via CLI:
```bash
vercel env add ANTHROPIC_API_KEY
# Follow prompts, paste value, select all environments
```

### 0.6 Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install ai @ai-sdk/anthropic
npm install nanoid
```

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Supabase client (DB + Realtime) |
| `@supabase/ssr` | Supabase SSR helpers for Next.js App Router |
| `ai` | Vercel AI SDK core |
| `@ai-sdk/anthropic` | Anthropic provider for Vercel AI SDK |
| `nanoid` | Generate short game IDs |

Commit:
```bash
git add .
git commit -m "chore: install core dependencies"
git push
```

### 0.7 Testing Strategy

**Local development:**
```bash
npm run dev
# App runs at http://localhost:3000
```
Use two browser windows (or Chrome + Firefox) to simulate P1 and P2 simultaneously. Supabase Realtime works from localhost — no tunnel or special setup needed.

**Preview deployments:**
Every pull request on GitHub gets a unique Vercel preview URL (e.g., `turing-game-git-feature-xyz.vercel.app`). Use these for testing multi-device or sharing with teammates for review before merging to main.

**Production:**
Merging to `main` deploys to your production URL. For MVP, `main` is your production branch.

**No dedicated test framework for MVP.** Manual testing across two browser sessions is sufficient. Add Playwright E2E tests post-MVP if the project continues.

---

## Phase 1 — Data Layer
> **Detail level: MEDIUM.**

- Write and run Supabase SQL migration to create `games` and `messages` tables with correct columns, types, and RLS policies.
- Enable Row Level Security: anonymous users can read/write messages for a game they know the ID of. Service role key bypasses RLS (used server-side only).
- Create `src/lib/supabase.ts` with browser client and server client factories.
- Write `src/app/api/create-game/route.ts`: generates nanoid, inserts game row, returns `gameId`.
- Smoke test: call the API route from the browser, verify row appears in Supabase table editor.

---

## Phase 2 — Realtime Channel (P1 ↔ P2)
> **Detail level: MEDIUM.**

- Build `src/app/join/[gameId]/page.tsx`: join screen with accept button, transitions to witness chat screen.
- On accept: insert a Supabase Realtime subscription to `messages` filtered by `game_id`. Update game status to `ready`.
- Build `src/app/game/[gameId]/page.tsx`: waiting screen that subscribes to game row status changes. On status = `ready`, render dual chat panel layout.
- Build `ChatPanel.tsx`: message list + input box. On send, inserts message row to Supabase. Realtime subscription renders incoming messages.
- Smoke test: open P1 and P2 in two tabs, confirm messages appear in real time in both directions.

---

## Phase 3 — Claude Agent Integration
> **Detail level: MEDIUM.**

- Write all four skill MD files in `src/agent-skills/`.
- Write `src/lib/claude.ts`: assembles system prompt from skill files (use `fs.readFileSync` — runs server-side only), fetches conversation history from Supabase, calls Claude via Vercel AI SDK `streamText`.
- Write `src/app/api/claude-message/route.ts` as an **Edge Runtime** route:
```typescript
export const runtime = 'edge'
```
  Receives `{ gameId, content }`, invokes `src/lib/claude.ts`, streams response, saves Claude's reply to `messages` table, returns stream to client.
- On P1's game screen: when P1 sends a message to Claude's slot, call `/api/claude-message` instead of writing directly to Supabase. Display streamed response token-by-token in the chat panel.
- Smoke test: send a message to Claude, verify streaming response appears, verify message saved to Supabase.

---

## Phase 4 — Timer, Guess, & Result
> **Detail level: LOW (schema only).**

- Implement `CountdownTimer.tsx` synced to `games.started_at` (not client clock — compute from Supabase timestamp to avoid drift).
- On timer expiry: disable chat inputs, begin 2-minute guess window.
- `GuessDropdown.tsx` per panel + submit button with disabled state logic.
- `src/app/api/end-game/route.ts`: receives guess, computes `guess_correct`, updates game row, triggers Claude final-reflection API call, broadcasts result via Supabase Realtime.
- `ResultOverlay.tsx`: displayed to P1 and P2 on game end.

---

## Phase 5 — Polish & Edge Cases
> **Detail level: LOW.**

- Handle P2 disconnect gracefully (silent chat, game continues).
- Handle timer expiry with no guess submitted (auto-resolve as `timeout`).
- Loading and error states for all API calls.
- Copy-to-clipboard for invite URL.
- Responsive layout check (desktop only for MVP).
- Final review of skill MD files — tune typo frequency and persona coherence.

---

## Deployment Checklist (before sharing with anyone)

- [ ] All four env vars set in Vercel for Production environment
- [ ] Supabase Realtime enabled on `messages` table
- [ ] RLS policies allow anonymous game access by `game_id`
- [ ] Edge runtime declared on `claude-message` route
- [ ] Skill MD files committed and readable server-side
- [ ] Tested full game flow end-to-end on production URL (not localhost)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `NEXT_PUBLIC_`

---

## Key Technical Decisions Summary

| Decision | Choice | Why |
|---|---|---|
| Hosting | Vercel Hobby (free) | Zero-config Next.js, preview deployments, edge runtime |
| Database + Realtime | Supabase free tier | Managed Postgres + Realtime pub/sub, no infra |
| Claude integration | Vercel AI SDK + @ai-sdk/anthropic | Streaming, edge-compatible, clean API |
| Claude model | `claude-sonnet-4-6` | Best balance of quality and cost for interactive chat |
| Game ID | nanoid 8-char | Short, URL-safe, collision-resistant at MVP scale |
| Auth | None — URL as credential | Simplest possible, acceptable for demo/MVP |
| Monorepo | No — single Next.js app | No benefit at this scale |
| Testing | Manual dual-browser + Vercel previews | Sufficient for MVP |
