# Turing Game — Detailed Implementation Plan
> Status: ACTIVE · Created: 2026-03-01

---

## How to Use This Document

Each phase is a self-contained implementation session. Before starting a phase:
1. Open this doc + the PRD + the IMPL doc as context
2. Switch to **Plan mode** — the Plan agent will draft the exact code approach for that phase
3. Switch to **Agent mode** — implement what Plan produced
4. Mark tasks done here as you go

Phases are **sequential** — each depends on the previous one being functional.

---

## Phase 0 — Environment & Tooling Setup

### Status: DONE

Everything confirmed in place:
- Vercel project `turing-game-v1` deployed and connected to GitHub
- Next.js 16 (App Router) scaffolded with TypeScript + Tailwind 4
- All dependencies installed (`@supabase/supabase-js`, `@supabase/ssr`, `ai`, `@ai-sdk/anthropic`, `nanoid`)
- `.env.local` has all 4 keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- File stubs for all pages, components, lib modules, API routes, and agent-skills MDs exist
- `pnpm dev` runs clean

### No remaining work.

---

## Phase 1 — Data Layer

### Status: DONE (code complete — awaiting human migration step)

All code written and lints clean. **One human action remains:** run the SQL migration.

---

### 1.1 — Supabase SQL Migration — DONE

**File:** `supabase/migrations/001_create_tables.sql`

Creates 4 enums (`game_status`, `slot_type`, `sender_type`, `guess_type`), `games` table, `messages` table with FK + indexes, enables Realtime on both tables, and adds permissive RLS policies (effectively open — no auth).

**Human action required — see Migration Instructions below.**

---

### 1.2 — Supabase Client Factories — DONE

**File:** `src/lib/supabase.ts`

Two exports:
- `createBrowserSupabaseClient()` — uses `createBrowserClient` from `@supabase/ssr` with anon key. For client components + Realtime.
- `createServerSupabaseClient()` — uses `createClient` from `@supabase/supabase-js` with service role key. For API routes. No cookie/middleware needed since there's no auth.

---

### 1.3 — Create Game API Route — DONE

**File:** `src/app/api/create-game/route.ts`

`POST /api/create-game` → generates 8-char nanoid, randomizes `claude_slot` (left/right), inserts into `games` with status `waiting`, returns `{ gameId }`.

**Smoke test (after migration):** `curl -X POST http://localhost:3000/api/create-game`

---

### 1.4 — Game Utility Types & Helpers — DONE

**File:** `src/lib/game.ts`

Exports:
- Types: `Game`, `Message`, `GameStatus`, `Slot`, `Sender`, `Guess`
- Helpers: `getGame(gameId)`, `getMessages(gameId, slot?)`, `insertMessage(...)`, `updateGame(gameId, updates)`

All server-side only (import `createServerSupabaseClient`).

---

### Migration Instructions (Human Action)

**Option A — Supabase SQL Editor (recommended, fastest):**

1. Go to your Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open `supabase/migrations/001_create_tables.sql` from your local repo
4. Copy the **entire file contents** and paste into the SQL Editor
5. Click **"Run"** (or Cmd+Enter)
6. You should see "Success. No rows returned" — this is correct for DDL statements
7. Verify: go to **Table Editor** in the sidebar — you should see `games` and `messages` tables
8. Verify columns: click on `games` — you should see: `id`, `status`, `claude_slot`, `claude_persona`, `p1_guess_left`, `p1_guess_right`, `guess_correct`, `created_at`, `started_at`, `ended_at`
9. Verify Realtime: go to **Database → Replication** — both `games` and `messages` should show as enabled (the migration does this via `ALTER PUBLICATION`)

**Option B — Supabase CLI (alternative):**

```bash
pnpm add -D supabase
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Option A is simpler for a one-time MVP setup. Option B is better if you plan to iterate on the schema.

**After migration, test the full chain:**
```bash
pnpm dev
# In another terminal:
curl -X POST http://localhost:3000/api/create-game
# Should return: {"gameId":"xxxxxxxx"}
# Check Supabase Table Editor — a row should appear in `games`
```

---

## Phase 2 — Realtime Channel (P1 ↔ P2)

### Status: DONE

All code written, TypeScript compiles clean, zero lint errors.

**Architecture decisions made during implementation:**

1. **P2 messages use a slot (not null)** — deviation from PRD. P2's messages are tagged with `slot = p2Slot` (opposite of `claude_slot`). This makes filtering trivial: each ChatPanel just filters by its slot. Without this, P1's panels can't know where to display P2's messages without knowing `claude_slot` (which must stay hidden from P1).

2. **`claude_slot` never reaches P1's browser** — P1's GameClient only fetches `id, status, started_at` from the games table. The join page server component computes `p2Slot` server-side and passes it as a prop, so `claude_slot` stays server-side.

3. **ChatPanel is "dumb"** — receives messages array + onSend callback. No internal Realtime logic. Parent components (GameClient / JoinClient) own all Supabase subscriptions and state. This avoids duplicate subscriptions and re-render bugs.

4. **Messages dedup by id** — both insert-response and Realtime can deliver the same message. All state updates check `prev.some(m => m.id === newMsg.id)` before adding.

5. **No auth middleware** — browser Supabase client uses anon key with permissive RLS policies. Direct inserts and updates from the client.

---

### Files written

| File | What |
|---|---|
| `src/app/globals.css` | Forced dark theme (no media query), Tailwind 4 `@theme inline` |
| `src/app/layout.tsx` | Updated metadata — "Turing Game" title + description |
| `src/app/page.tsx` | Home page — title, description, "Create Game" button → POST /api/create-game → redirect |
| `src/components/ChatPanel.tsx` | Reusable chat UI — message bubbles (emerald for self, gray for others), auto-scroll, input + send |
| `src/app/game/[gameId]/page.tsx` | Server wrapper — extracts gameId, renders GameClient |
| `src/app/game/[gameId]/game-client.tsx` | **NEW** — P1 client component. Waiting lobby (invite URL + copy + pulse indicator) → dual ChatPanel layout. Subscribes to game status + messages via Supabase Realtime. |
| `src/app/join/[gameId]/page.tsx` | Server wrapper — fetches game, computes p2Slot, handles not-found/ended |
| `src/app/join/[gameId]/join-client.tsx` | **NEW** — P2 client component. Join screen (AI disclosure + Accept button) → single ChatPanel. Updates game status to `ready` on join. |

### How to test

1. `pnpm dev`
2. Open `http://localhost:3000` → click "Create Game" → lands on waiting lobby
3. Copy the invite URL → open in a second browser tab
4. Click "Accept & Join" in tab 2 → tab 1 auto-transitions to dual chat panels
5. Send messages from P1 (either panel) → P2 sees messages in their slot
6. Send messages from P2 → P1 sees them in the correct panel
7. Claude's slot stays silent (expected — Phase 3)

---

## Phase 3 — Claude Agent Integration

### Goal
Claude joins the game. When P1 messages Claude's slot, the message goes to the API, Claude responds via streaming, and the response appears in real time.

---

### 3.1 — Agent Skill Files

> **BLOCKED — DO NOT IMPLEMENT**
> Teammate is authoring and testing all four skill MD files independently. Final versions will be pasted in when ready. Do not write or overwrite any file under `src/agent-skills/` until the teammate's docs arrive.

| Field | Detail |
|---|---|
| **What** | Write the content for all four skill MD files: `persona.md` (instructions for Claude to generate and maintain a consistent human persona — name, age, location, occupation, speech patterns; on first call output persona JSON), `typo-engine.md` (15% chance per message of one minor typo — transposed letters, missing apostrophe, autocorrect; never on proper nouns, max one per message), `pacing.md` (short replies to short questions, casual register, filler words, avoid over-punctuating), `result-reflection.md` (post-game only — brief in-character reaction to whether they fooled P1). |
| **Where** | `src/agent-skills/persona.md`, `typo-engine.md`, `pacing.md`, `result-reflection.md` (replace stubs) |
| **Why** | These are injected into Claude's system prompt to make it behave convincingly human |
| **Dependencies** | None |
| **Human action** | Paste teammate's final MD docs into `src/agent-skills/` when received, then unblock this task |
| **Testable now?** | Not standalone — tested via 3.3 |

**Agent instruction (HOLD):** Do not invoke any agent for skill files. Wait for teammate to deliver the final MD content.

---

### 3.2 — Claude Invocation Helper

| Field | Detail |
|---|---|
| **What** | Implement `src/lib/claude.ts`. Exports a function `invokeClaudeStream(gameId, userMessage)` that: (1) reads all four skill MD files using `fs.readFileSync` (server-side only), (2) fetches the game row to get `claude_persona` (null on first call), (3) fetches full conversation history from `messages` where `slot = claude_slot`, (4) assembles the system prompt from skill files + persona JSON, (5) calls `streamText` from `ai` package with `anthropic('claude-sonnet-4-6')` model, (6) returns the stream. Also exports `generatePersona(gameId)` that makes the first Claude call to generate persona JSON and saves it to `games.claude_persona`. |
| **Where** | `src/lib/claude.ts` (replace stub) |
| **Why** | Central orchestrator for all Claude interactions |
| **Dependencies** | 3.1 (skill files), Phase 1 (game/message queries) |
| **Human action** | None |
| **Testable now?** | Not standalone — tested via 3.3 |

**Important edge-case:** `fs.readFileSync` does NOT work in Edge Runtime. Decision needed: either (a) use Node runtime for the claude-message route instead of Edge, or (b) inline the skill file contents at build time, or (c) import them as raw strings. Plan agent should evaluate and decide.

---

### 3.3 — Claude Message API Route

| Field | Detail |
|---|---|
| **What** | Implement `POST /api/claude-message`. Receives `{ gameId, content }`. Inserts P1's message into `messages` table (sender=p1, slot=claude_slot). Invokes `invokeClaudeStream`. Streams response back to client. On stream complete, saves Claude's full reply to `messages` table (sender=claude, slot=claude_slot). If `games.claude_persona` is null, trigger persona generation first. |
| **Where** | `src/app/api/claude-message/route.ts` (replace stub) |
| **Why** | The bridge between P1's chat panel and Claude |
| **Dependencies** | 3.2, Phase 1 |
| **Human action** | Ensure `ANTHROPIC_API_KEY` is valid and has credits |
| **Testable now?** | Yes — send a message to Claude's slot from P1's game screen, see streaming response appear |

---

### 3.4 — Wire Claude into P1's Chat Panel

| Field | Detail |
|---|---|
| **What** | Modify P1's game screen: when P1 sends a message in the Claude slot's ChatPanel, instead of inserting directly to Supabase, call `POST /api/claude-message` and render the streamed response token-by-token. The P2 slot ChatPanel remains unchanged (direct Supabase insert). P1 should not know which slot is Claude — the routing logic reads `claude_slot` from the game row server-side only. |
| **Where** | `src/app/game/[gameId]/page.tsx` (extend), `src/components/ChatPanel.tsx` (add streaming support) |
| **Why** | Completes the core game mechanic — P1 talks to both a human and Claude without knowing which is which |
| **Dependencies** | 3.3, Phase 2 |
| **Human action** | None |
| **Testable now?** | Yes — full three-party test: P1 messages both panels, P2 replies in one, Claude replies in the other. Both show up in real time. |

---

### Phase 3 — Pre-implementation Prompt

> "Plan agent: I need to implement Phase 3 of the Turing Game (Claude agent integration). Read `docs/PLAN-implementation.md` Phase 3, `docs/PRD-turing-game.md` Section 6 (Claude Agent Spec), and the current code at `src/lib/claude.ts`, `src/app/api/claude-message/route.ts`, `src/components/ChatPanel.tsx`, `src/app/game/[gameId]/page.tsx`, and all files in `src/agent-skills/`. Produce the implementation plan with code for: (1) four skill MD files, (2) claude.ts invocation helper with streaming via Vercel AI SDK, (3) claude-message API route, (4) wiring streaming into ChatPanel. Decide on Edge vs Node runtime given fs.readFileSync needs. Model: claude-sonnet-4-6."

---

## Phase 4 — Timer, Guess & Result

### Goal
Add the countdown timer, guess submission, game ending logic, and result reveal. This completes the full game loop.

---

### 4.1 — Countdown Timer Component

| Field | Detail |
|---|---|
| **What** | Implement `CountdownTimer.tsx`. Props: `startedAt` (ISO timestamp from `games.started_at`), `duration` (default 150s = 2:30), `onExpire` callback. Computes remaining time from server timestamp (not client clock) to avoid drift. Displays `MM:SS` format. Visual urgency change in last 30 seconds (color shift). |
| **Where** | `src/components/CountdownTimer.tsx` (replace stub) |
| **Why** | Games are time-bounded — timer is the core pacing mechanism |
| **Dependencies** | Phase 2 (game screen exists to mount it) |
| **Human action** | None |
| **Testable now?** | Yes — renders on game screen once wired, counts down from `started_at` |

---

### 4.2 — Guess UI Components

| Field | Detail |
|---|---|
| **What** | Implement `GuessDropdown.tsx`. Props: `slot` (left/right), `value`, `onChange`, `disabled`. Renders a dropdown with options "This witness is human" / "This witness is AI". Implement a "Submit Guess" button (lives in the game page, not the component) that is disabled until both dropdowns have a selection. Visible at all times during active game but only submittable when selections are made. |
| **Where** | `src/components/GuessDropdown.tsx` (replace stub), guess button in `src/app/game/[gameId]/page.tsx` |
| **Why** | The entire point of the game — P1 decides who is human and who is AI |
| **Dependencies** | Phase 2 (game screen) |
| **Human action** | None |
| **Testable now?** | Partially — UI renders and state works. Full test requires 4.3. |

---

### 4.3 — End Game API Route

| Field | Detail |
|---|---|
| **What** | Implement `POST /api/end-game`. Receives `{ gameId, guessLeft, guessRight }`. Computes `guess_correct` by comparing guesses against `games.claude_slot`. Updates game row: `p1_guess_left`, `p1_guess_right`, `guess_correct`, `status = ended`, `ended_at = now()`. Triggers one final Claude API call with result context (using `result-reflection.md` skill) — saves Claude's reflection as a final message. Returns result payload. Supabase Realtime broadcasts the game status change to all subscribers. |
| **Where** | `src/app/api/end-game/route.ts` (replace stub) |
| **Why** | Resolves the game — the moment of truth |
| **Dependencies** | Phase 1, Phase 3 (Claude reflection call) |
| **Human action** | None |
| **Testable now?** | Yes — submit guess, verify game row updates, Claude reflection message appears |

---

### 4.4 — Result Overlay Component

| Field | Detail |
|---|---|
| **What** | Implement `ResultOverlay.tsx`. Displayed when `games.status = ended`. Shows: which slot was Claude, which was P2, whether P1 guessed correctly, and Claude's final reflection message. For P2's screen: shows whether they fooled the interrogator. Overlay covers the game screen with a semi-transparent backdrop. Includes a "Play Again" button that links back to `/`. |
| **Where** | `src/components/ResultOverlay.tsx` (replace stub) |
| **Why** | Payoff moment of the game — both players see the reveal |
| **Dependencies** | 4.3 (end-game route produces the data) |
| **Human action** | None |
| **Testable now?** | Yes — full game loop: create → join → chat → guess → result |

---

### 4.5 — Game State Transitions (Timer Expiry + Guess Window)

| Field | Detail |
|---|---|
| **What** | Wire the full state machine on P1's game page. When main timer expires: disable chat inputs, update game status to `guessing`, start 2-minute guess countdown. If guess timer expires with no submission: auto-resolve as `timeout` (call end-game with null guesses, `guess_correct = false`). If P1 submits guess before main timer: end game immediately (early guess). P2's screen: disable input on timer expire, show "Waiting for result..." |
| **Where** | `src/app/game/[gameId]/page.tsx` (extend), `src/app/join/[gameId]/page.tsx` (extend) |
| **Why** | Complete the game flow state machine per PRD Sections 3.3 and 3.4 |
| **Dependencies** | 4.1, 4.2, 4.3, 4.4 |
| **Human action** | None |
| **Testable now?** | Yes — this is the full game loop end-to-end |

---

### Phase 4 — Pre-implementation Prompt

> "Plan agent: I need to implement Phase 4 of the Turing Game (timer, guess, result). Read `docs/PLAN-implementation.md` Phase 4, `docs/PRD-turing-game.md` Sections 3.3–3.5 and 4.2, and the current code at `src/components/CountdownTimer.tsx`, `src/components/GuessDropdown.tsx`, `src/components/ResultOverlay.tsx`, `src/app/api/end-game/route.ts`, `src/app/game/[gameId]/page.tsx`, and `src/app/join/[gameId]/page.tsx`. Produce the implementation plan with code for: (1) countdown timer synced to server timestamp, (2) guess dropdowns + submit button, (3) end-game API route with guess evaluation + Claude reflection, (4) result overlay, (5) full game state machine (active → guessing → ended, early guess, timeout). Handle all transitions."

---

## Phase 5 — Polish & Edge Cases

### Goal
Harden the experience. Handle disconnects, errors, loading states. Make it feel finished.

---

### 5.1 — Loading & Error States

| Field | Detail |
|---|---|
| **What** | Add loading skeletons/spinners for: game page initial load, chat message sending, Claude response waiting. Add error boundaries and user-friendly error messages for: failed API calls, invalid gameId, game already ended. Use toast or inline error patterns. |
| **Where** | All page and component files — `src/app/game/[gameId]/page.tsx`, `src/app/join/[gameId]/page.tsx`, `src/components/ChatPanel.tsx` |
| **Why** | Without these, failures are silent and confusing |
| **Dependencies** | Phases 1–4 complete |
| **Human action** | None |
| **Testable now?** | Yes — test with invalid URLs, kill Supabase connection, etc. |

---

### 5.2 — P2 Disconnect Handling

| Field | Detail |
|---|---|
| **What** | If P2 disconnects mid-game (closes tab, loses connection), the game continues. P2's chat slot goes silent. No reconnection logic for MVP. Optionally: detect via Supabase Presence and show a subtle "Witness may have disconnected" indicator on P1's screen after 30s of inactivity in P2's slot. |
| **Where** | `src/app/game/[gameId]/page.tsx`, potentially `src/components/ChatPanel.tsx` |
| **Why** | PRD says game continues on disconnect — but P1 shouldn't be confused by silence |
| **Dependencies** | Phase 2 |
| **Human action** | None |
| **Testable now?** | Yes — close P2's tab mid-game, verify P1's game continues |

---

### 5.3 — Copy-to-Clipboard for Invite URL

| Field | Detail |
|---|---|
| **What** | On the waiting lobby screen, the invite URL copy button should use the Clipboard API with a "Copied!" feedback animation. Fallback for browsers that don't support Clipboard API. |
| **Where** | `src/app/game/[gameId]/page.tsx` |
| **Why** | Core UX — this is how P2 gets invited |
| **Dependencies** | Phase 2 |
| **Human action** | None |
| **Testable now?** | Yes |

---

### 5.4 — Responsive Layout Check + Visual Polish

| Field | Detail |
|---|---|
| **What** | Ensure the dual-panel layout works on standard desktop viewports (1280px+). Not mobile-optimized per PRD, but should not break on tablet. Final pass on colors, spacing, typography. Dark theme. Ensure chat panels have proper overflow scroll, input doesn't overlap timer, result overlay is centered. |
| **Where** | `src/app/globals.css`, all component and page files |
| **Why** | Visual quality — the game should feel polished even as an MVP |
| **Dependencies** | Phases 1–4 |
| **Human action** | Visual review in browser at different viewport widths |
| **Testable now?** | Yes — manual visual inspection |

---

### 5.5 — Skill File Tuning

| Field | Detail |
|---|---|
| **What** | Play 3–5 full games against Claude. Tune `persona.md`, `typo-engine.md`, and `pacing.md` based on where Claude feels obviously non-human. Common issues: replies too long, too formal, too fast, inconsistent persona details. Adjust instructions iteratively. |
| **Where** | `src/agent-skills/*.md` |
| **Why** | The game is only fun if Claude is hard to distinguish from a human |
| **Dependencies** | Phases 1–4 (need full game loop to test) |
| **Human action** | Yes — play the game and evaluate Claude's performance subjectively |
| **Testable now?** | Yes — play the game |

---

### Phase 5 — Pre-implementation Prompt

> "Plan agent: I need to implement Phase 5 of the Turing Game (polish and edge cases). Read `docs/PLAN-implementation.md` Phase 5, `docs/PRD-turing-game.md` Sections 7–8, and the current code across all pages and components. Produce the implementation plan for: (1) loading/error states across all pages, (2) P2 disconnect handling, (3) clipboard copy with feedback, (4) responsive layout and visual polish pass, (5) identify any remaining gaps vs the PRD. Skip skill file tuning — that's manual."

---

## Deployment Checklist (Post Phase 5)

| # | Task | Owner |
|---|---|---|
| 1 | Set all 4 env vars in Vercel for Production + Preview | Human |
| 2 | Verify Supabase Realtime enabled on `messages` AND `games` tables | Human |
| 3 | Confirm Edge/Node runtime is correct on claude-message route | Agent |
| 4 | Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `NEXT_PUBLIC_` | Agent |
| 5 | Skill MD files committed and readable server-side | Agent |
| 6 | Full end-to-end game on production URL (not localhost) | Human |
| 7 | Push env vars to Vercel via CLI or dashboard | Human |

---

## Dependency Install Summary

All dependencies are already installed. For reference:

| Package | Installed | Phase Used |
|---|---|---|
| `@supabase/supabase-js` | Yes | 1+ |
| `@supabase/ssr` | Yes | 1+ |
| `ai` | Yes | 3+ |
| `@ai-sdk/anthropic` | Yes | 3+ |
| `nanoid` | Yes | 1 |
| `supabase` (CLI, devDep) | **Not yet** | 1 (optional — only if using CLI for migrations) |

If Supabase CLI is desired for migrations: `pnpm add -D supabase`

---

## Quick Reference — File Map

| File | Phase Built | Purpose |
|---|---|---|
| `supabase/migrations/001_create_tables.sql` | 1 | Schema DDL |
| `src/lib/supabase.ts` | 1 | Client factories |
| `src/lib/game.ts` | 1 | Types + query helpers |
| `src/app/api/create-game/route.ts` | 1 | Create game |
| `src/app/page.tsx` | 2 | Home page |
| `src/app/game/[gameId]/page.tsx` | 2, 4 | P1 lobby + game screen |
| `src/app/join/[gameId]/page.tsx` | 2, 4 | P2 join + witness screen |
| `src/components/ChatPanel.tsx` | 2, 3 | Chat UI (reusable) |
| `src/agent-skills/*.md` | 3, 5 | Claude system prompt injection |
| `src/lib/claude.ts` | 3 | Claude invocation logic |
| `src/app/api/claude-message/route.ts` | 3 | Claude API bridge |
| `src/components/CountdownTimer.tsx` | 4 | Game timer |
| `src/components/GuessDropdown.tsx` | 4 | Guess selection |
| `src/app/api/end-game/route.ts` | 4 | End game + scoring |
| `src/components/ResultOverlay.tsx` | 4 | Result reveal |
