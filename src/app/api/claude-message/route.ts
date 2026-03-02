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

  // Compulsory human-like "reading + typing" delay (3-10s, proportional to message length)
  const charFactor = Math.min(content.length / 150, 1);
  const minDelay = 3000 + charFactor * 3000; // 3s (short msg) → 6s (long msg)
  const maxDelay = 5000 + charFactor * 5000; // 5s (short msg) → 10s (long msg)
  const delayMs = minDelay + Math.random() * (maxDelay - minDelay);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

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
