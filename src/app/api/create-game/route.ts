import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Slot } from "@/lib/game";

export async function POST() {
  const gameId = nanoid(8);
  const claudeSlot: Slot = Math.random() < 0.5 ? "left" : "right";

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("games").insert({
    id: gameId,
    status: "waiting",
    claude_slot: claudeSlot,
  });

  if (error) {
    console.error("[create-game]", error.message, error.details, error.hint);
    return NextResponse.json(
      { error: "Failed to create game", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ gameId });
}
