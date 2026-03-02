"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ChatPanel } from "@/components/ChatPanel";
import type { GameStatus, Message, Slot } from "@/lib/game";

export function GameClient({ gameId }: { gameId: string }) {
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  // Fetch initial game state — only non-sensitive columns (no claude_slot)
  useEffect(() => {
    supabase
      .from("games")
      .select("id, status, started_at")
      .eq("id", gameId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Game not found");
          return;
        }
        setGameStatus(data.status as GameStatus);
      });
  }, [gameId, supabase]);

  // Subscribe to game status changes
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}-status`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as { status: string };
          setGameStatus(updated.status as GameStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // Subscribe to messages (always active — empty until game starts)
  useEffect(() => {
    supabase
      .from("messages")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    const channel = supabase
      .channel(`game-${gameId}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  const sendMessage = useCallback(
    async (slot: Slot, content: string) => {
      const { data } = await supabase
        .from("messages")
        .insert({ game_id: gameId, sender: "p1", slot, content })
        .select()
        .single();

      if (data) {
        const msg = data as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    },
    [gameId, supabase]
  );

  const copyInviteUrl = useCallback(() => {
    const url = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [gameId]);

  // ── Error state ──
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </main>
    );
  }

  // ── Loading ──
  if (gameStatus === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#555]">Loading game...</p>
      </main>
    );
  }

  // ── Waiting Lobby ──
  if (gameStatus === "waiting") {
    const inviteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${gameId}`
        : `/join/${gameId}`;

    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 max-w-lg px-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Waiting for opponent&hellip;</h1>
            <p className="text-[#888]">
              Share this link with a friend to start the game
            </p>
          </div>

          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-3">
            <code className="flex-1 text-sm text-emerald-400 truncate">
              {inviteUrl}
            </code>
            <button
              onClick={copyInviteUrl}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-white text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[#666]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm">Listening for connection&hellip;</span>
          </div>
        </div>
      </main>
    );
  }

  // ── Active Game — Dual Chat Panels ──
  const leftMessages = messages.filter((m) => m.slot === "left");
  const rightMessages = messages.filter((m) => m.slot === "right");
  const isEnded = gameStatus === "ended";

  return (
    <main className="h-screen flex flex-col">
      <header className="shrink-0 px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <h1 className="text-lg font-semibold">Turing Game</h1>
        {/* Timer will go here in Phase 4 */}
        <span className="text-sm text-[#555] font-mono">{gameId}</span>
      </header>

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel
            messages={leftMessages}
            onSend={(content) => sendMessage("left", content)}
            label="Witness A"
            currentSender="p1"
            disabled={isEnded}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel
            messages={rightMessages}
            onSend={(content) => sendMessage("right", content)}
            label="Witness B"
            currentSender="p1"
            disabled={isEnded}
          />
        </div>
      </div>
    </main>
  );
}
