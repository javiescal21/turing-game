import { NextResponse } from "next/server";
import { getGame, insertMessage } from "@/lib/game";
import { analyzeGame } from "@/lib/claude";

export async function POST(req: Request) {
  const { gameId, feedback, skip } = (await req.json()) as {
    gameId: string;
    feedback?: string;
    skip?: boolean;
  };

  if (!gameId) {
    return NextResponse.json(
      { error: "gameId is required" },
      { status: 400 }
    );
  }

  const game = await getGame(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "ended") {
    return NextResponse.json(
      { error: "Game has not ended yet" },
      { status: 400 }
    );
  }

  if (!skip && feedback?.trim()) {
    await insertMessage({
      game_id: gameId,
      sender: "p1",
      slot: null,
      content: `[FEEDBACK] ${feedback.trim()}`,
    });
  }

  // Fire-and-forget: compound lessons after feedback is saved (or skipped)
  analyzeGame(gameId).catch((e) =>
    console.error("[game-feedback] lesson analysis failed:", e)
  );

  return NextResponse.json({ ok: true });
}
