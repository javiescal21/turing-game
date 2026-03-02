"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ChatPanel } from "@/components/ChatPanel";
import type { GameStatus, Message, Slot } from "@/lib/game";

type Phase = "join" | "chat" | "ended";

function statusToPhase(status: GameStatus): Phase {
  if (status === "waiting") return "join";
  if (status === "ended") return "ended";
  return "chat";
}

interface JoinClientProps {
  gameId: string;
  p2Slot: Slot;
  initialStatus: GameStatus;
}

export function JoinClient({ gameId, p2Slot, initialStatus }: JoinClientProps) {
  const [phase, setPhase] = useState<Phase>(statusToPhase(initialStatus));
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  // Subscribe to game status changes
  useEffect(() => {
    const channel = supabase
      .channel(`join-${gameId}-status`)
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
          setPhase(statusToPhase(updated.status as GameStatus));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // Subscribe to messages for P2's slot
  useEffect(() => {
    if (phase !== "chat") return;

    supabase
      .from("messages")
      .select("*")
      .eq("game_id", gameId)
      .eq("slot", p2Slot)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    const channel = supabase
      .channel(`join-${gameId}-messages`)
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
          if (newMsg.slot !== p2Slot) return;
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
  }, [gameId, p2Slot, phase, supabase]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    const { error } = await supabase
      .from("games")
      .update({ status: "ready", started_at: new Date().toISOString() })
      .eq("id", gameId);

    if (error) {
      setJoining(false);
      return;
    }
    setPhase("chat");
  }, [gameId, supabase]);

  const sendMessage = useCallback(
    async (content: string) => {
      const { data } = await supabase
        .from("messages")
        .insert({ game_id: gameId, sender: "p2", slot: p2Slot, content })
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
    [gameId, p2Slot, supabase]
  );

  // ── Join Screen ──
  if (phase === "join") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-8 max-w-md px-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              You&apos;ve been invited
            </h1>
            <p className="text-[#888] text-lg leading-relaxed">
              You&apos;ll chat with an interrogator who is trying to figure out
              if you&apos;re human or AI.
            </p>
          </div>

          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-sm text-[#888] leading-relaxed">
            <span className="text-amber-400 font-medium">Heads up:</span> One
            of the witnesses in this game is an AI. The interrogator doesn&apos;t
            know which one is you. Just be yourself.
          </div>

          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-medium rounded-xl text-lg transition-colors cursor-pointer disabled:cursor-wait"
          >
            {joining ? "Joining..." : "Accept & Join"}
          </button>
        </div>
      </main>
    );
  }

  // ── Game Ended ──
  if (phase === "ended") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#888] text-lg">This game has ended.</p>
      </main>
    );
  }

  // ── Witness Chat ──
  return (
    <main className="h-screen flex flex-col">
      <header className="shrink-0 px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <h1 className="text-lg font-semibold">Turing Game</h1>
        {/* Timer will go here in Phase 4 */}
        <span className="text-sm text-emerald-400">Witness</span>
      </header>

      <div className="flex-1 flex flex-col p-4 max-w-2xl mx-auto w-full min-h-0">
        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          label="Chat with the Interrogator"
          currentSender="p2"
        />
      </div>
    </main>
  );
}
