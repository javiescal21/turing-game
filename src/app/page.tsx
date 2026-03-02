"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-game", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create game");
      const { gameId } = await res.json();
      router.push(`/game/${gameId}`);
    } catch {
      setError("Failed to create game. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-4">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Turing Game</h1>
          <p className="text-[#888] text-lg leading-relaxed">
            Chat with two witnesses &mdash; one human, one AI. Can you tell
            which is which?
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-medium rounded-xl text-lg transition-colors cursor-pointer disabled:cursor-wait"
          >
            {loading ? "Creating..." : "Create Game"}
          </button>

          {error && (
            <p className="text-red-400 text-sm animate-in fade-in">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
