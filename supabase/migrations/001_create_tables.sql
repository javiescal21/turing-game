-- Turing Game — Phase 1 Migration
-- Run this in Supabase SQL Editor (copy-paste the entire file)
-- No RLS for MVP

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE game_status AS ENUM ('waiting', 'ready', 'active', 'guessing', 'ended');
CREATE TYPE slot_type   AS ENUM ('left', 'right');
CREATE TYPE sender_type AS ENUM ('p1', 'p2', 'claude');
CREATE TYPE guess_type  AS ENUM ('human', 'ai');

-- ============================================================
-- GAMES TABLE
-- ============================================================

CREATE TABLE games (
  id             TEXT        PRIMARY KEY,                -- nanoid, 8 chars
  status         game_status NOT NULL DEFAULT 'waiting',
  claude_slot    slot_type   NOT NULL,                   -- hidden from P1
  claude_persona JSONB,                                  -- generated at game start by Claude
  p1_guess_left  guess_type,
  p1_guess_right guess_type,
  guess_correct  BOOLEAN,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,                            -- set when P2 accepts
  ended_at       TIMESTAMPTZ
);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================

CREATE TABLE messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    TEXT        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sender     sender_type NOT NULL,
  slot       slot_type,                                  -- null for P2 messages
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_game_id ON messages(game_id);
CREATE INDEX idx_messages_game_slot ON messages(game_id, slot);

-- ============================================================
-- REALTIME
-- ============================================================
-- Enable Realtime on both tables so subscriptions work from the browser.
-- This uses Supabase's publication system.

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- ============================================================
-- DISABLE RLS (MVP — no auth)
-- ============================================================

ALTER TABLE games    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to games"    ON games    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);
