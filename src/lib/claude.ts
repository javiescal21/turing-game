import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Message } from "./game";

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
  persona: Record<string, unknown> | null
): string {
  const skills = getSkills();

  const personaBlock = persona
    ? `\n\n## Your assigned persona (stay consistent):\n\`\`\`json\n${JSON.stringify(persona, null, 2)}\n\`\`\``
    : "";

  return `${skills.persona}${personaBlock}\n\n---\n\n${skills.pacing}\n\n---\n\n${skills.typo}`;
}

// ── Conversation history → AI SDK format ─────────────────────

export function buildConversationHistory(
  messages: Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.sender === "p1" || m.sender === "claude")
    .map((m) => ({
      role: (m.sender === "p1" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.content,
    }));
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
