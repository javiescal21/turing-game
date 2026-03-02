"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ChatPanel } from "@/components/ChatPanel";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { GameStatus, Message, Slot } from "@/lib/game";
import { GAME_DURATION_SECONDS } from "@/lib/game";

type Phase = "join" | "chat" | "guessing" | "ended";

function statusToPhase(status: GameStatus): Phase {
  if (status === "waiting") return "join";
  if (status === "guessing") return "guessing";
  if (status === "ended") return "ended";
  return "chat";
}

interface JoinClientProps {
  gameId: string;
  p2Slot: Slot;
  initialStatus: GameStatus;
  initialStartedAt: string | null;
}

export function JoinClient({
  gameId,
  p2Slot,
  initialStatus,
  initialStartedAt,
}: JoinClientProps) {
  const [phase, setPhase] = useState<Phase>(statusToPhase(initialStatus));
  const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt);
  const [messages, setMessages] = useState<Message[]>([]);
  const [joining, setJoining] = useState(false);

  // Result state
  const [guessCorrect, setGuessCorrect] = useState<boolean | null>(null);

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
          const updated = payload.new as {
            status: string;
            started_at?: string;
          };
          setPhase(statusToPhase(updated.status as GameStatus));
          if (updated.started_at) setStartedAt(updated.started_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // Subscribe to messages for P2's slot
  useEffect(() => {
    if (phase !== "chat" && phase !== "guessing") return;

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

  // Fetch result when game ends
  useEffect(() => {
    if (phase !== "ended") return;
    supabase
      .from("games")
      .select("guess_correct")
      .eq("id", gameId)
      .single()
      .then(({ data }) => {
        if (data) setGuessCorrect(data.guess_correct);
      });
  }, [phase, gameId, supabase]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("games")
      .update({ status: "ready", started_at: now })
      .eq("id", gameId);

    if (error) {
      setJoining(false);
      return;
    }
    setStartedAt(now);
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

  const handleChatTimerExpire = useCallback(() => {
    setPhase("guessing");
  }, []);

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
            of the witnesses in this game is an AI. The interrogator
            doesn&apos;t know which one is you. Just be yourself.
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

  // ── Game Ended — Result for P2 ──
  if (phase === "ended") {
    const fooledThem = guessCorrect === false;

    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md px-4">
          {guessCorrect === null ? (
            <p className="text-[#555]">Loading result...</p>
          ) : (
            <>
              <p className="text-4xl">{fooledThem ? "🎭" : "🔍"}</p>
              <h2
                className={`text-2xl font-bold ${fooledThem ? "text-emerald-400" : "text-red-400"}`}
              >
                {fooledThem
                  ? "You fooled the interrogator!"
                  : "The interrogator saw through it."}
              </h2>
              <p className="text-[#888]">
                {fooledThem
                  ? "They couldn't tell you apart from the AI. Well played."
                  : "They correctly identified who was human and who was AI."}
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
              >
                Play Again
              </Link>
            </>
          )}
        </div>
      </main>
    );
  }

  // ── Witness Chat (active or guessing) ──
  const isChatDisabled = phase === "guessing";

  return (
    <main className="h-screen flex flex-col">
      <header className="shrink-0 px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <h1 className="text-lg font-semibold">Turing Game</h1>
        {startedAt && phase === "chat" && (
          <CountdownTimer
            startedAt={startedAt}
            durationSeconds={GAME_DURATION_SECONDS}
            onExpire={handleChatTimerExpire}
          />
        )}
        {phase === "guessing" && (
          <span className="text-sm text-amber-400 font-mono">
            Time&apos;s up
          </span>
        )}
        <span className="text-sm text-emerald-400">Witness</span>
      </header>

      {isChatDisabled && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-center">
          <p className="text-amber-400 text-sm font-medium">
            ⏰ Time&apos;s up! Waiting for the interrogator&apos;s guess&hellip;
          </p>
        </div>
      )}

      <div className="flex-1 flex flex-col p-4 max-w-2xl mx-auto w-full min-h-0">
        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          label="Chat with the Interrogator"
          currentSender="p2"
          disabled={isChatDisabled}
        />
      </div>
    </main>
  );
}
