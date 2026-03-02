"use client";

import Link from "next/link";
import type { Slot, Guess } from "@/lib/game";

interface ResultOverlayProps {
  claudeSlot: Slot;
  guessCorrect: boolean | null;
  guessLeft: Guess | null;
  guessRight: Guess | null;
}

export function ResultOverlay({
  claudeSlot,
  guessCorrect,
  guessLeft,
  guessRight,
}: ResultOverlayProps) {
  const isTimeout = !guessLeft && !guessRight;
  const humanSlot: Slot = claudeSlot === "left" ? "right" : "left";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full mx-4 space-y-6 text-center">
        {/* Result headline */}
        {isTimeout ? (
          <div className="space-y-2">
            <p className="text-4xl">⏰</p>
            <h2 className="text-2xl font-bold text-amber-400">Time&apos;s Up</h2>
            <p className="text-[#888]">
              You didn&apos;t submit a guess in time.
            </p>
          </div>
        ) : guessCorrect ? (
          <div className="space-y-2">
            <p className="text-4xl">🎉</p>
            <h2 className="text-2xl font-bold text-emerald-400">
              Correct!
            </h2>
            <p className="text-[#888]">
              You identified the AI. Sharp instincts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-4xl">🤖</p>
            <h2 className="text-2xl font-bold text-red-400">Fooled!</h2>
            <p className="text-[#888]">The AI slipped past you this time.</p>
          </div>
        )}

        {/* Identity reveal */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div
            className={`rounded-xl p-3 border ${
              claudeSlot === "left"
                ? "border-red-500/40 bg-red-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <p className="text-[#888] text-xs mb-1">Witness A</p>
            <p className="font-semibold">
              {claudeSlot === "left" ? "🤖 AI" : "🧑 Human"}
            </p>
            {guessLeft && (
              <p className="text-xs text-[#666] mt-1">
                You guessed: {guessLeft === "ai" ? "AI" : "Human"}
                {" "}
                {((claudeSlot === "left" && guessLeft === "ai") ||
                  (humanSlot === "left" && guessLeft === "human")) &&
                  "✓"}
              </p>
            )}
          </div>
          <div
            className={`rounded-xl p-3 border ${
              claudeSlot === "right"
                ? "border-red-500/40 bg-red-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <p className="text-[#888] text-xs mb-1">Witness B</p>
            <p className="font-semibold">
              {claudeSlot === "right" ? "🤖 AI" : "🧑 Human"}
            </p>
            {guessRight && (
              <p className="text-xs text-[#666] mt-1">
                You guessed: {guessRight === "ai" ? "AI" : "Human"}
                {" "}
                {((claudeSlot === "right" && guessRight === "ai") ||
                  (humanSlot === "right" && guessRight === "human")) &&
                  "✓"}
              </p>
            )}
          </div>
        </div>

        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
        >
          Play Again
        </Link>
      </div>
    </div>
  );
}
