# PRD — Turing Game (MVP)
> Status: TEMPLATE · Version: 0.1 · Last updated: {{DATE}}

---

## 1. Overview

A browser-based, two-player Turing test game. One human interrogator (P1) chats simultaneously with a human witness (P2) and an AI agent (Claude) within a timed session, then guesses which is which.

### 1.1 Problem Statement
<!-- Why does this exist? What experience does it create? -->
Turing tests are conceptually compelling but have no lightweight, shareable, browser-native format. This app makes the experience instant and social — generate a link, share it, play.

### 1.2 Success Metrics (MVP)
- A full game (create → invite → play → result) completes without errors
- P1 can distinguish or fail to distinguish Claude from P2
- Claude maintains a consistent persona throughout the session
- Result is delivered to all parties within 5 seconds of game end

---

## 2. Actors & Roles

| ID | Name | Description |
|---|---|---|
| P1 | Interrogator | Creates the game, receives invite URL to share, chats with both witnesses, submits final guess |
| P2 | Human Witness | Receives invite URL, joins game, chats with P1 through a simple single-chat interface, receives result |
| Claude | AI Witness | Stateless agent invoked per message via API, maintains persona via injected skill files and conversation history |

---

## 3. Game Flow

### 3.1 Phase 0 — Game Creation
1. P1 visits the app homepage.
2. P1 clicks **"Create Game"**.
3. App generates a unique `gameId` (nanoid, 8 chars) and creates a `games` row in Supabase with status `waiting`.
4. App randomly assigns Claude to either the `left` or `right` chat slot and stores the assignment in the game row (hidden from P1's UI).
5. P1 is routed to `/game/[gameId]` and sees a **waiting screen** with the P2 invite URL (`/join/[gameId]`) and a copy button.
6. P1 waits. Game cannot start until P2 joins.

### 3.2 Phase 1 — P2 Joins
1. P2 opens `/join/[gameId]`.
2. P2 sees a join screen: game description, disclosure that one witness is an AI, and a **"Accept & Join"** button.
3. On accept, Supabase Realtime subscription is established for the game's message channel.
4. Game row status updates to `ready`. P1's waiting screen detects this update and transitions to the game screen.

### 3.3 Phase 2 — Active Game (4 minutes)
- Countdown timer (4 minutes) begins **simultaneously** for P1 and P2 the moment status becomes `ready`.
- **P1 screen:** Two identical side-by-side chat panels labeled "Witness A" and "Witness B" (no other identifying information). Left/right assignment is randomized per game. Both inputs are always active.
- **P2 screen:** Single chat panel. P2 sees messages from P1 only and responds normally.
- **Claude:** Receives P1 messages via `/api/claude-message`. Each call includes full conversation history + injected system prompt (persona + skill files). Streams response back. Response is saved to Supabase and displayed in P1's corresponding chat panel.
- **Guess component:** Each chat panel has a dropdown ("This witness is human" / "This witness is AI") visible at all times. A single **"Submit Guess"** button below both panels is disabled until both dropdowns have a selection.
  - Submitting guess before timer ends triggers immediate game end.
  - Guessing is not possible while timer is still running AND both dropdowns are unset (button remains disabled).

### 3.4 Phase 3 — Guessing Window (if timer expires)
- Timer reaches 0. Both chat input boxes are disabled and visually locked. Chat history remains visible.
- A 2-minute guessing countdown begins.
- P1 must select both dropdowns and submit before this secondary timer expires.
- If P1 fails to submit within 2 minutes: game auto-resolves with guess marked as `timeout` (counts as incorrect for scoring purposes).

### 3.5 Phase 4 — Result & Teardown
1. Guess is recorded in Supabase.
2. Game row status updates to `ended`.
3. **P1 screen:** Reveal animation — panels labeled with true identity. Correct/incorrect result shown.
4. **P2 screen:** Notified whether they fooled the interrogator.
5. **Claude:** One final API call is made with the result context. Claude generates a short in-character reflection on the game (e.g., "I had you fooled, didn't I?" or "I figured you'd catch me on that last message."). This is displayed in Claude's chat panel as a final message.
6. Supabase Realtime channel is closed. No further writes to the game row.

---

## 4. Screens & Components

### 4.1 P1 — Game Lobby (`/game/[gameId]`)
- Invite URL display with copy button
- Waiting state indicator
- Transitions to game screen automatically on P2 join

### 4.2 P1 — Game Screen
- Dual chat panels (ChatPanel × 2)
- Shared countdown timer (top center)
- GuessDropdown per panel
- SubmitGuess button (disabled until both dropdowns selected)
- ResultOverlay (post-game)

### 4.3 P2 — Join Screen (`/join/[gameId]`)
- Game description
- AI disclosure notice
- Accept & Join CTA

### 4.4 P2 — Witness Screen
- Single chat panel
- Countdown timer
- Post-game result notification

### 4.5 Home (`/`)
- App description
- Create Game CTA

---

## 5. Data Model (Supabase)

### `games`
| Column | Type | Notes |
|---|---|---|
| id | text (PK) | nanoid, 8 chars |
| status | enum | `waiting` · `ready` · `active` · `guessing` · `ended` |
| claude_slot | enum | `left` · `right` — hidden from P1 |
| claude_persona | jsonb | Generated at game start, persisted here |
| p1_guess_left | enum | `human` · `ai` · null |
| p1_guess_right | enum | `human` · `ai` · null |
| guess_correct | boolean | null until resolved |
| created_at | timestamptz | |
| started_at | timestamptz | When P2 accepts |
| ended_at | timestamptz | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| game_id | text (FK → games) | |
| sender | enum | `p1` · `p2` · `claude` |
| slot | enum | `left` · `right` · null (P2 messages have null) |
| content | text | |
| created_at | timestamptz | |

---

## 6. Claude Agent Spec

### 6.1 Invocation Pattern
Claude is called **on-demand** per P1 message. There is no persistent agent process. Each API call reconstructs context from:
- System prompt (assembled from skill MD files)
- Full conversation history fetched from `messages` table
- Current game metadata (persona, game status)

### 6.2 Skill Files
Located at `/agent-skills/` in the repo. Injected into system prompt at call time.

| File | Purpose |
|---|---|
| `persona.md` | Instructions to generate and maintain a consistent human persona. On first invocation, Claude outputs persona JSON which is saved to `games.claude_persona`. Subsequent calls reload it. |
| `typo-engine.md` | Probabilistic instructions for realistic human typing imperfections. 15% chance per message of one minor error (transposed letter, missing apostrophe, autocorrect substitution). Never on proper nouns. Never more than one per message. |
| `pacing.md` | Response length and register calibration. Short replies to short questions. Casual filler words occasionally. Avoid excessive punctuation or formal structure. |
| `result-reflection.md` | Instructions for the final post-game message only. Claude breaks from normal pacing to give a brief, in-character reaction to the game result. |

### 6.3 API Choice
Vercel AI SDK (`ai` package) with `@ai-sdk/anthropic` provider. Enables streaming responses over Edge Runtime and avoids Vercel's 60-second serverless timeout. Model: `claude-sonnet-4-6`.

---

## 7. Open Questions & Decisions Log

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | P2 URL: fixed or dynamic? | Dynamic `/join/[gameId]`, expires on game end | Simpler state management, URL = credential |
| 2 | Authentication | None — URL is the access token | MVP scope |
| 3 | Does P2 know Claude is in the game? | Yes — disclosed on join screen | Ethical clarity; the challenge is fooling P1 |
| 4 | Can P1 message both witnesses simultaneously? | Yes — both inputs always active | Core game mechanic |
| 5 | Early guess behavior | Submitting guess ends game immediately | Allows skilled interrogators to finish early |
| 6 | P2 disconnect mid-game | Game continues; their chat goes silent | No reconnection logic in MVP |
| 7 | Monorepo / Turborepo | No — single Next.js app | Unnecessary complexity at this scale |
| 8 | Claude API integration | Vercel AI SDK + @ai-sdk/anthropic | Streaming + edge runtime + clean DX |

---

## 8. Out of Scope (MVP)
- User accounts or authentication
- Game history or leaderboards
- Multiple AI models or model selection
- P2 vs Claude scoring over time
- Mobile-optimized layout
- Spectator mode
- Reconnection handling
- Rate limiting or abuse prevention

---

## 9. Non-Functional Requirements
- Game URL must be shareable and joinable within seconds of creation
- Claude response latency should not exceed 5 seconds for typical short messages
- App must function on desktop Chrome/Firefox/Safari
- No PII is collected

---

*This is a living template. Fill `{{PLACEHOLDER}}` fields before handing to engineering.*
