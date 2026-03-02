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

### Status: DONE

All code written, TypeScript compiles clean, zero lint errors.

**Runtime decision: Node (not Edge).** `fs.readFileSync` for skill files doesn't work in Edge Runtime. Node's 60s timeout is more than sufficient for chat messages. The `export const runtime = 'edge'` declaration was removed.

**Architecture decisions:**

1. **All P1 messages go through `/api/claude-message`** — the server checks `slot === claude_slot` and either returns JSON (P2's slot) or streams Claude's response. P1's client uses the same code path for both slots. This prevents the client from needing to know which slot is Claude's. The response content-type difference (JSON vs text/plain) is technically observable in DevTools but acceptable for MVP — response time already differs (Claude is faster than a human).

2. **Persona generated on first invocation** — a separate non-streaming `generateText` call creates a persona JSON on the first message to Claude. The JSON is saved to `games.claude_persona` and injected into subsequent system prompts for consistency. Fallback hardcoded persona if JSON parsing fails.

3. **Skill files read via `fs.readFileSync`** — cached at module level (read once per cold start). Files live in `src/agent-skills/` and are readable via `process.cwd()`.

4. **Streaming state management** — `streamingSlot` + `streamingContent` state in GameClient. A `streamingSlotRef` keeps the Realtime handler in sync with the stream reader. When Realtime delivers Claude's saved message, streaming state is cleared atomically to avoid visual gaps.

5. **Optimistic P1 messages** — P1's message appears immediately with a `pending-*` id. When Realtime delivers the server-confirmed message, the pending duplicate is replaced.

---

### Files written/updated

| File | What |
|---|---|
| `src/agent-skills/persona.md` | Character instructions — maintain consistent persona, avoid AI tells, never break character |
| `src/agent-skills/typo-engine.md` | ~15% chance of one minor typo per message — transposed letters, missing apostrophes, autocorrect artifacts |
| `src/agent-skills/pacing.md` | Response length calibration — match question energy, use casual register, avoid formal structure |
| `src/agent-skills/result-reflection.md` | Post-game only — brief in-character reaction referencing specific conversation moments |
| `src/lib/claude.ts` | `buildSystemPrompt()`, `buildConversationHistory()`, `generatePersona()` — skill file loading, prompt assembly, message format mapping |
| `src/app/api/claude-message/route.ts` | Handles both slots — inserts P1 message, invokes Claude for Claude's slot (streaming), returns JSON for P2's slot. `onFinish` saves Claude's complete response to Supabase. |
| `src/components/ChatPanel.tsx` | Added `streamingContent` prop — renders streaming text bubble with animated cursor |
| `src/app/game/[gameId]/game-client.tsx` | Rewired `sendMessage` to call API for all slots. Reads stream for Claude's slot. Manages streaming state with ref + state for safe Realtime integration. |
| `src/app/api/end-game/route.ts` | Fixed stub (was a bare comment causing TS error) — now returns 501 placeholder |

### How to test

1. Ensure `ANTHROPIC_API_KEY` in `.env.local` is a valid key with credits
2. `pnpm dev`
3. Create a game, join from a second tab
4. P1: send messages to both panels
5. One panel streams Claude's response token-by-token (with animated cursor)
6. Other panel delivers P2's manual responses via Realtime
7. P1 cannot tell which panel is Claude from the UI alone

### Human action required

- Verify `ANTHROPIC_API_KEY` is valid and has credits (replace `sk-ant-your-api-key-here` if still placeholder)

---

## Phase 4 — Timer, Guess & Result

### Goal
Add the countdown timer, guess submission, game ending logic, and result reveal. This completes the full game loop.

---

### 4.1 — Countdown Timer Component ✅

| Field | Detail |
|---|---|
| **What** | `CountdownTimer.tsx` — server-synced timer using `started_at` ISO timestamp. 250ms tick interval for smooth display. `onExpire` callback ref pattern avoids stale closures. Urgency pulse animation in last 30s. Duration: **4 minutes** (240s) for game, **2 minutes** (120s) for guess window. |
| **Where** | `src/components/CountdownTimer.tsx` |
| **Status** | **DONE** |

---

### 4.2 — Guess UI Components ✅

| Field | Detail |
|---|---|
| **What** | `GuessDropdown.tsx` — styled select with "Human" / "AI" options. Mounted below each chat panel. "Submit Guess" button centered below both panels, disabled until both selections made. Constants `GAME_DURATION_SECONDS` and `GUESS_DURATION_SECONDS` exported from `src/lib/game.ts`. |
| **Where** | `src/components/GuessDropdown.tsx`, constants in `src/lib/game.ts` |
| **Status** | **DONE** |

---

### 4.3 — End Game API Route ✅

| Field | Detail |
|---|---|
| **What** | `POST /api/end-game` — accepts `{ gameId, guessLeft, guessRight }` or `{ gameId, timeout: true }`. Computes `guess_correct` by comparing guesses against `claude_slot`. Updates game row (status `ended`, `ended_at`). Generates Claude reflection via `generateReflection()` (best-effort, uses `result-reflection.md` skill + conversation history). Saves reflection as final message. Returns `{ guessCorrect, claudeSlot }`. |
| **Where** | `src/app/api/end-game/route.ts` |
| **Architectural decisions** | Reflection generated after status update — arrives via Realtime as a late message in Claude's panel. Timeout sets `guess_correct = false`, null guesses. |
| **Status** | **DONE** |

---

### 4.4 — Result Overlay Component ✅

| Field | Detail |
|---|---|
| **What** | `ResultOverlay.tsx` (P1) — fixed overlay with backdrop blur. Shows correct/incorrect/timeout headline, identity reveal grid (Witness A / B with true identity + what P1 guessed), "Play Again" link. P2 result is inline in `join-client.tsx` — shows "You fooled the interrogator!" or "They saw through it." with Play Again. |
| **Where** | `src/components/ResultOverlay.tsx`, P2 result in `src/app/join/[gameId]/join-client.tsx` |
| **Status** | **DONE** |

---

### 4.5 — Game State Transitions ✅

| Field | Detail |
|---|---|
| **What** | Full state machine wired in `game-client.tsx`. States: `waiting → ready → guessing → ended`. On chat timer expire: P1 client updates status to `guessing`, starts 2-min guess countdown. On guess timeout: auto-calls `/api/end-game` with `timeout: true`. Early guess: calls `/api/end-game` immediately. P2 reacts to `guessing` (chat disabled, "Waiting for guess" banner) and `ended` (result screen). `claude_slot` only fetched after game ends (anti-cheat). |
| **Where** | `src/app/game/[gameId]/game-client.tsx`, `src/app/join/[gameId]/join-client.tsx`, `src/app/join/[gameId]/page.tsx` |
| **Status** | **DONE** |

---

### Phase 4 — Implementation Summary

**Files created/modified:**
- `src/components/CountdownTimer.tsx` — full implementation (server-synced, ref-based callback)
- `src/components/GuessDropdown.tsx` — full implementation (styled select)
- `src/components/ResultOverlay.tsx` — full implementation (P1 reveal overlay)
- `src/app/api/end-game/route.ts` — full implementation (guess eval + reflection)
- `src/lib/claude.ts` — added `generateReflection()` function
- `src/lib/game.ts` — added `GAME_DURATION_SECONDS` (240) and `GUESS_DURATION_SECONDS` (120)
- `src/app/game/[gameId]/game-client.tsx` — major rewrite (state machine, timer, guess, overlay)
- `src/app/join/[gameId]/page.tsx` — passes `initialStartedAt` prop
- `src/app/join/[gameId]/join-client.tsx` — timer, guessing/ended phases, P2 result screen
- `docs/PRD-turing-game.md` — timer updated from 2:30 to 4 minutes

**Architectural decisions (P4):**
1. Timer synced to `started_at` server timestamp — avoids client clock drift
2. `claude_slot` only fetched when status becomes `ended` — prevents P1 cheating
3. Guess window timer is client-side (resets on refresh) — acceptable for MVP
4. P1 triggers `guessing` transition — P2 reacts via Realtime
5. Reflection generated after status update — appears as late Realtime message
6. `onExpire` callback uses ref pattern to avoid stale closure re-rendering issues

**Testing instructions:**
1. Create game, copy invite URL
2. Open invite in incognito, join
3. Chat back and forth — verify 4:00 timer counting down
4. Select guesses from both dropdowns
5. Submit guess → verify ResultOverlay shows correct reveal
6. Verify P2 sees result screen ("fooled" or "saw through it")
7. Test timeout: let chat timer expire → verify guessing banner + 2:00 countdown → let it expire → verify auto-timeout result
8. Test early guess: submit guess while chat timer is still running → verify immediate end

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
