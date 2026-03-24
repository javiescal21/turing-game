"use client";

import { useState } from "react";
import Link from "next/link";
import type { Slot, Guess } from "@/lib/game";

interface ResultOverlayProps {
  gameId: string;
  claudeSlot: Slot;
  guessCorrect: boolean | null;
  guessLeft: Guess | null;
  guessRight: Guess | null;
}

export function ResultOverlay({
  gameId,
  claudeSlot,
  guessCorrect,
  guessLeft,
  guessRight,
}: ResultOverlayProps) {
  const isTimeout = !guessLeft && !guessRight;
  const humanSlot: Slot = claudeSlot === "left" ? "right" : "left";
  const [feedback, setFeedback] = useState("");
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "sending" | "sent" | "skipped"
  >("idle");

  return (
    <>
    <div className="fixed inset-0 z-40 bg-black/60" />
    <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 px-4 flex justify-center items-start">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl shadow-black/50 space-y-5 text-center w-full max-w-md">
        {/* Result headline */}
        {isTimeout ? (
          <div className="space-y-1">
            <p className="text-3xl">⏰</p>
            <h2 className="text-xl font-bold text-amber-400">
              Time&apos;s Up
            </h2>
            <p className="text-[#888] text-sm">
              You didn&apos;t submit a guess in time.
            </p>
          </div>
        ) : guessCorrect ? (
          <div className="space-y-1">
            <p className="text-3xl">🎉</p>
            <h2 className="text-xl font-bold text-emerald-400">Correct!</h2>
            <p className="text-[#888] text-sm">
              You identified the AI. Sharp instincts.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-3xl">🤖</p>
            <h2 className="text-xl font-bold text-red-400">Fooled!</h2>
            <p className="text-[#888] text-sm">
              The AI slipped past you this time.
            </p>
          </div>
        )}

        {/* Identity reveal */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div
            className={`rounded-xl p-2.5 border ${
              claudeSlot === "left"
                ? "border-red-500/40 bg-red-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <p className="text-[#888] text-xs mb-0.5">Witness A</p>
            <p className="font-semibold">
              {claudeSlot === "left" ? "🤖 AI" : "🧑 Human"}
            </p>
            {guessLeft && (
              <p className="text-xs text-[#666] mt-0.5">
                You guessed: {guessLeft === "ai" ? "AI" : "Human"}{" "}
                {((claudeSlot === "left" && guessLeft === "ai") ||
                  (humanSlot === "left" && guessLeft === "human")) &&
                  "✓"}
              </p>
            )}
          </div>
          <div
            className={`rounded-xl p-2.5 border ${
              claudeSlot === "right"
                ? "border-red-500/40 bg-red-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <p className="text-[#888] text-xs mb-0.5">Witness B</p>
            <p className="font-semibold">
              {claudeSlot === "right" ? "🤖 AI" : "🧑 Human"}
            </p>
            {guessRight && (
              <p className="text-xs text-[#666] mt-0.5">
                You guessed: {guessRight === "ai" ? "AI" : "Human"}{" "}
                {((claudeSlot === "right" && guessRight === "ai") ||
                  (humanSlot === "right" && guessRight === "human")) &&
                  "✓"}
              </p>
            )}
          </div>
        </div>

        {(feedbackState === "idle" || feedbackState === "sending") && (
          <div className="space-y-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What gave the AI away? Any tips?"
              rows={2}
              disabled={feedbackState === "sending"}
              className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-[#ededed] placeholder-[#666] focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-50"
            />
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={async () => {
                  if (!feedback.trim()) return;
                  setFeedbackState("sending");
                  try {
                    await fetch("/api/game-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gameId, feedback: feedback.trim() }),
                    });
                  } catch { /* best-effort */ }
                  setFeedbackState("sent");
                }}
                disabled={!feedback.trim() || feedbackState === "sending"}
                className="px-6 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#2a2a2a] disabled:text-[#555] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:cursor-default"
              >
                {feedbackState === "sending" ? "Sending..." : "Send Feedback"}
              </button>
              <button
                onClick={async () => {
                  setFeedbackState("sending");
                  try {
                    await fetch("/api/game-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gameId, skip: true }),
                    });
                  } catch { /* best-effort */ }
                  setFeedbackState("skipped");
                }}
                disabled={feedbackState === "sending"}
                className="text-sm text-[#666] hover:text-[#999] transition-colors cursor-pointer disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {(feedbackState === "sent" || feedbackState === "skipped") && (
          <div className="space-y-3">
            {feedbackState === "sent" && (
              <p className="text-emerald-400 text-sm">Thanks for the feedback!</p>
            )}
            <Link
              href="/"
              className="inline-block px-8 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Play Again
            </Link>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
