import { createServerSupabaseClient } from "./supabase";

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
