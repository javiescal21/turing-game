import { NextResponse } from "next/server";
import { getGame, insertMessage } from "@/lib/game";

export async function POST(req: Request) {
  const { gameId, feedback } = (await req.json()) as {
    gameId: string;
    feedback: string;
  };

  if (!gameId || !feedback?.trim()) {
    return NextResponse.json(
      { error: "gameId and feedback are required" },
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

  await insertMessage({
    game_id: gameId,
    sender: "p1",
    slot: null,
    content: `[FEEDBACK] ${feedback.trim()}`,
  });

  return NextResponse.json({ ok: true });
}
