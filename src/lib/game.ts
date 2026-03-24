import { createServerSupabaseClient } from "./supabase";

export const GAME_DURATION_SECONDS = 240; // 4 minutes
export const GUESS_DURATION_SECONDS = 120; // 2 minutes

// ── Types ────────────────────────────────────────────────────

export type GameStatus = "waiting" | "ready" | "active" | "guessing" | "ended";
export type Slot = "left" | "right";
export type Sender = "p1" | "p2" | "claude";
export type Guess = "human" | "ai";

export interface Game {
  id: string;
  status: GameStatus;
  claude_slot: Slot;
  claude_persona: Record<string, unknown> | null;
  p1_guess_left: Guess | null;
  p1_guess_right: Guess | null;
  guess_correct: boolean | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface Message {
  id: string;
  game_id: string;
  sender: Sender;
  slot: Slot | null;
  content: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  game_id: string | null;
  content: string;
  weight: number;
  created_at: string;
  updated_at: string;
}

// ── Query helpers (server-side only) ─────────────────────────

export async function getGame(gameId: string): Promise<Game | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error || !data) return null;
  return data as Game;
}

export async function getMessages(
  gameId: string,
  slot?: Slot
): Promise<Message[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("messages")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (slot) {
    query = query.eq("slot", slot);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Message[];
}

export async function insertMessage(
  msg: Omit<Message, "id" | "created_at">
): Promise<Message | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .insert(msg)
    .select()
    .single();

  if (error || !data) return null;
  return data as Message;
}

export async function updateGame(
  gameId: string,
  updates: Partial<Omit<Game, "id">>
): Promise<Game | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("games")
    .update(updates)
    .eq("id", gameId)
    .select()
    .single();

  if (error || !data) return null;
  return data as Game;
}

// ── Lesson helpers (server-side only) ─────────────────────────

const MAX_LESSONS = 15;

export async function getLessons(): Promise<Lesson[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .order("weight", { ascending: false });

  if (error || !data) return [];
  return data as Lesson[];
}

export async function upsertLessons(
  lessons: {
    id?: string;
    game_id: string | null;
    content: string;
    weight: number;
  }[]
): Promise<void> {
  if (lessons.length === 0) return;
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();

  const toInsert = lessons.filter((l) => !l.id);
  const toUpdate = lessons.filter((l) => l.id);

  if (toInsert.length > 0) {
    await supabase.from("lessons").insert(
      toInsert.map((l) => ({
        game_id: l.game_id,
        content: l.content,
        weight: l.weight,
        updated_at: now,
      }))
    );
  }

  for (const l of toUpdate) {
    await supabase
      .from("lessons")
      .update({ weight: l.weight, updated_at: now })
      .eq("id", l.id!);
  }
}

export async function evictExcessLessons(): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, weight")
    .order("weight", { ascending: true });

  if (!data || data.length <= MAX_LESSONS) return;

  const toDelete = data.slice(0, data.length - MAX_LESSONS);
  const ids = toDelete.map((l) => l.id);
  await supabase.from("lessons").delete().in("id", ids);
}
