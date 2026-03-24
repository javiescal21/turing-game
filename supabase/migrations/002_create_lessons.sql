-- Turing Game — Phase 6 Migration: Compounding Lessons
-- Run this in Supabase SQL Editor (copy-paste the entire file)

CREATE TABLE lessons (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    TEXT        REFERENCES games(id) ON DELETE SET NULL,
  content    TEXT        NOT NULL,
  weight     SMALLINT    NOT NULL DEFAULT 5 CHECK (weight >= 1 AND weight <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_weight ON lessons(weight DESC);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to lessons" ON lessons FOR ALL USING (true) WITH CHECK (true);
