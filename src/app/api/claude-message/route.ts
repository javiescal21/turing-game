import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getGame, getMessages, insertMessage, updateGame } from "@/lib/game";
import {
  buildSystemPrompt,
  buildConversationHistory,
  generatePersona,
} from "@/lib/claude";

export async function POST(req: Request) {
  const { gameId, slot, content } = await req.json();

  const game = await getGame(gameId);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Insert P1's message into Supabase (both slots go through here)
  await insertMessage({
    game_id: gameId,
    sender: "p1",
    slot,
    content,
  });

  // If this is NOT Claude's slot, just confirm — P2 responds via Realtime
  if (slot !== game.claude_slot) {
    return NextResponse.json({ ok: true });
  }

  // ── Claude's slot — generate response ──

  // Generate persona on first invocation
  let persona = game.claude_persona;
  if (!persona) {
    persona = await generatePersona();
    await updateGame(gameId, {
      claude_persona: persona as Record<string, unknown>,
    });
  }

  // Build system prompt and conversation history
  const systemPrompt = buildSystemPrompt(persona as Record<string, unknown>);
  const history = await getMessages(gameId, game.claude_slot);
  const conversationMessages = buildConversationHistory(history);

  // Stream Claude's response
  const result = streamText({
    model: anthropic("claude-haiku-4-5"), // TODO: swap to claude-sonnet-4-6 for final testing
    system: systemPrompt,
    messages: conversationMessages,
    onFinish: async ({ text }) => {
      await insertMessage({
        game_id: gameId,
        sender: "claude",
        slot: game.claude_slot,
        content: text,
      });
    },
  });

  return result.toTextStreamResponse();
}
