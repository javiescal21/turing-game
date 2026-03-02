import { NextResponse } from "next/server";
import {
  getGame,
  getMessages,
  insertMessage,
  updateGame,
} from "@/lib/game";
import { buildConversationHistory, generateReflection } from "@/lib/claude";
import type { Guess } from "@/lib/game";

export async function POST(req: Request) {
  const body = await req.json();
  const { gameId, timeout } = body as {
    gameId: string;
    guessLeft?: Guess;
    guessRight?: Guess;
    timeout?: boolean;
  };

  const game = await getGame(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status === "ended") {
    return NextResponse.json({ error: "Game already ended" }, { status: 400 });
  }

  let guessCorrect: boolean;
  let guessLeft: Guess | null = null;
  let guessRight: Guess | null = null;

  if (timeout) {
    guessCorrect = false;
  } else {
    guessLeft = body.guessLeft as Guess;
    guessRight = body.guessRight as Guess;

    if (!guessLeft || !guessRight) {
      return NextResponse.json(
        { error: "Both guesses required" },
        { status: 400 }
      );
    }

    // Correct if P1 identified the Claude slot as AI and the other as human
    if (game.claude_slot === "left") {
      guessCorrect = guessLeft === "ai" && guessRight === "human";
    } else {
      guessCorrect = guessRight === "ai" && guessLeft === "human";
    }
  }

  // Update game row
  await updateGame(gameId, {
    p1_guess_left: guessLeft,
    p1_guess_right: guessRight,
    guess_correct: guessCorrect,
    status: "ended",
    ended_at: new Date().toISOString(),
  });

  // Generate Claude's post-game reflection (best-effort, don't block on failure)
  try {
    if (game.claude_persona) {
      const history = await getMessages(gameId, game.claude_slot);
      const conversationMessages = buildConversationHistory(history);
      const reflection = await generateReflection(
        game.claude_persona,
        conversationMessages,
        guessCorrect
      );
      await insertMessage({
        game_id: gameId,
        sender: "claude",
        slot: game.claude_slot,
        content: reflection,
      });
    }
  } catch (e) {
    console.error("[end-game] reflection generation failed:", e);
  }

  return NextResponse.json({
    guessCorrect,
    claudeSlot: game.claude_slot,
  });
}
