import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Message, Lesson } from "./game";
import {
  getGame,
  getMessages,
  getLessons,
  upsertLessons,
  evictExcessLessons,
} from "./game";

// ── Skill file loading (cached at module level) ──────────────

const skillsDir = path.join(process.cwd(), "src", "agent-skills");

function readSkill(filename: string): string {
  return fs.readFileSync(path.join(skillsDir, filename), "utf-8");
}

let skillCache: { persona: string; typo: string; pacing: string } | null =
  null;

function getSkills() {
  if (!skillCache) {
    skillCache = {
      persona: readSkill("persona.md"),
      typo: readSkill("typo-engine.md"),
      pacing: readSkill("pacing.md"),
    };
  }
  return skillCache;
}

// ── System prompt assembly ───────────────────────────────────

export function buildSystemPrompt(
  persona: Record<string, unknown> | null,
  lessons?: Lesson[]
): string {
  const skills = getSkills();

  const personaBlock = persona
    ? `\n\n## Your assigned persona (stay consistent):\n\`\`\`json\n${JSON.stringify(persona, null, 2)}\n\`\`\``
    : "";

  const lessonsBlock =
    lessons && lessons.length > 0
      ? `\n\n## Lessons from past games (apply these strictly):\n${lessons.map((l) => `- [priority ${l.weight}/10] ${l.content}`).join("\n")}`
      : "";

  return `${skills.persona}${personaBlock}${lessonsBlock}\n\n---\n\n${skills.pacing}\n\n---\n\n${skills.typo}`;
}

// ── Conversation history → AI SDK format ─────────────────────

export function buildConversationHistory(
  messages: Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  const raw = messages
    .filter((m) => m.sender === "p1" || m.sender === "claude")
    .map((m) => ({
      role: (m.sender === "p1" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  // Anthropic requires strictly alternating user/assistant turns.
  // Merge consecutive messages with the same role (can happen if two messages
  // are sent before Claude responds).
  return raw.reduce<Array<{ role: "user" | "assistant"; content: string }>>(
    (acc, msg) => {
      if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
        acc[acc.length - 1] = {
          ...acc[acc.length - 1],
          content: acc[acc.length - 1].content + "\n\n" + msg.content,
        };
      } else {
        acc.push({ ...msg });
      }
      return acc;
    },
    []
  );
}

// ── Result reflection (one-time, post-game) ──────────────────

export async function generateReflection(
  persona: Record<string, unknown>,
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
  guessCorrect: boolean
): Promise<string> {
  const reflectionSkill = readSkill("result-reflection.md");

  const resultContext = guessCorrect
    ? "GAME OVER: The interrogator correctly identified you as the AI. They won."
    : "GAME OVER: The interrogator thought you were human. You fooled them!";

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: `${reflectionSkill}\n\nYour persona:\n${JSON.stringify(persona, null, 2)}`,
    messages: [
      ...conversationMessages,
      { role: "user", content: resultContext },
    ],
  });

  return text;
}

// ── Post-game compounding analyst ─────────────────────────────

export async function analyzeGame(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game || game.status !== "ended") return;

  const allMessages = await getMessages(gameId);
  const claudeSlotLabel = game.claude_slot === "left" ? "A" : "B";
  const humanSlotLabel = game.claude_slot === "left" ? "B" : "A";

  const claudeConvo = allMessages
    .filter((m) => m.slot === game.claude_slot)
    .map((m) => `[${m.sender === "p1" ? "Interrogator" : "Claude"}]: ${m.content}`)
    .join("\n");

  const humanConvo = allMessages
    .filter((m) => m.slot !== game.claude_slot && m.slot !== null)
    .map((m) => `[${m.sender === "p1" ? "Interrogator" : "Human"}]: ${m.content}`)
    .join("\n");

  const feedbackMessages = allMessages.filter(
    (m) => m.sender === "p1" && m.slot === null && m.content.startsWith("[FEEDBACK] ")
  );
  const feedbackText =
    feedbackMessages.length > 0
      ? feedbackMessages.map((m) => m.content.replace("[FEEDBACK] ", "")).join("\n")
      : "None provided";

  let resultLabel: string;
  if (game.guess_correct === null) {
    resultLabel = "Timed out (no guess submitted)";
  } else if (game.guess_correct) {
    resultLabel = "Interrogator correctly identified the AI";
  } else {
    resultLabel = "AI fooled the interrogator";
  }

  const existingLessons = await getLessons();
  const existingLessonsBlock =
    existingLessons.length > 0
      ? existingLessons
          .map((l) => `- id="${l.id}" weight=${l.weight}: ${l.content}`)
          .join("\n")
      : "None yet";

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are a post-game analyst for a Turing test game. Your job is to extract actionable lessons that help the AI perform more convincingly as a human in future games, and to re-evaluate the importance of existing lessons based on new evidence.`,
    prompt: `GAME RESULT: The AI was Witness ${claudeSlotLabel}. Result: ${resultLabel}.

CLAUDE'S CONVERSATION (Witness ${claudeSlotLabel}):
${claudeConvo || "(no messages)"}

HUMAN WITNESS CONVERSATION (Witness ${humanSlotLabel}, for comparison):
${humanConvo || "(no messages)"}

INTERROGATOR FEEDBACK:
${feedbackText}

EXISTING LESSONS (re-evaluate these):
${existingLessonsBlock}

INSTRUCTIONS:
1. Compare Claude's behavior to the human witness. Note differences in tone, length, timing, word choice.
2. If the interrogator provided feedback, weigh it heavily — they know what gave the AI away.
3. Produce 0-2 NEW lessons ONLY if there is a clear, actionable mistake or opportunity. Each lesson must be a single imperative sentence. If Claude performed well and there is nothing to learn, return zero new lessons.
4. Re-evaluate the weight (1-10) of ALL existing lessons based on whether this game reinforces or contradicts them. Lessons repeatedly validated should increase. Lessons about problems Claude no longer exhibits should decrease.
5. Respond with ONLY a JSON object, no markdown fences, no other text:

{"new_lessons":[{"content":"imperative lesson","weight":1-10}],"updated_weights":{"existing-lesson-uuid":new_weight}}`,
  });

  try {
    const result = JSON.parse(text) as {
      new_lessons: { content: string; weight: number }[];
      updated_weights: Record<string, number>;
    };

    const updates: {
      id?: string;
      game_id: string | null;
      content: string;
      weight: number;
    }[] = [];

    for (const lesson of existingLessons) {
      const newWeight = result.updated_weights[lesson.id];
      if (newWeight !== undefined && newWeight !== lesson.weight) {
        updates.push({
          id: lesson.id,
          game_id: lesson.game_id,
          content: lesson.content,
          weight: Math.max(1, Math.min(10, Math.round(newWeight))),
        });
      }
    }

    if (result.new_lessons && result.new_lessons.length > 0) {
      for (const nl of result.new_lessons.slice(0, 2)) {
        updates.push({
          game_id: gameId,
          content: nl.content,
          weight: Math.max(1, Math.min(10, Math.round(nl.weight))),
        });
      }
    }

    if (updates.length > 0) {
      await upsertLessons(updates);
    }
    await evictExcessLessons();
  } catch (e) {
    console.error("[analyzeGame] Failed to parse analyst response:", e, text);
  }
}

// ── Persona generation (one-time per game) ───────────────────

export async function generatePersona(): Promise<Record<string, unknown>> {
  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are a persona generator for a Turing test game played by ITAM (Instituto Tecnológico Autónomo de México) students in Mexico City. Generate a believable ITAM student persona. Respond with ONLY a JSON object, no other text. The persona should feel like a real, specific ITAM student — not a generic template.`,
    prompt: `Generate a JSON object with these fields:
- "name": a common Mexican first name
- "age": number between 19 and 25
- "location": "CDMX, Mexico"
- "university": "ITAM"
- "major": one of "Ingeniería en Computación", "Ciencia de Datos", "Ingeniería Industrial", "Matemáticas Aplicadas", "Actuaría", "Economía"
- "semester": number between 3 and 9
- "interests": array of 3-4 hobbies (mix of academic and casual, realistic for a Mexican college student — NOT all tech-related)
- "personality_notes": a sentence describing their texting style and personality quirks

Example: {"name":"Diego","age":21,"location":"CDMX, Mexico","university":"ITAM","major":"Ciencia de Datos","semester":5,"interests":["gym","futbol","series de netflix","leetcode"],"personality_notes":"direct and concise, mixes spanish and english naturally, capitalizes normally, dry humor, sometimes sarcastic"}`,
  });

  try {
    return JSON.parse(text);
  } catch {
    return {
      name: "Carlos",
      age: 21,
      location: "CDMX, Mexico",
      university: "ITAM",
      major: "Ingeniería en Computación",
      semester: 5,
      interests: ["gym", "futbol", "series", "coding"],
      personality_notes:
        "casual but direct, capitalizes normally, mix of spanish and english, dry humor",
    };
  }
}
