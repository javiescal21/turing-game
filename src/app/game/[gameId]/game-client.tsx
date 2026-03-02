"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { ChatPanel } from "@/components/ChatPanel";
import { CountdownTimer } from "@/components/CountdownTimer";
import { GuessDropdown } from "@/components/GuessDropdown";
import { ResultOverlay } from "@/components/ResultOverlay";
import type { GameStatus, Message, Slot, Guess } from "@/lib/game";
import { GAME_DURATION_SECONDS, GUESS_DURATION_SECONDS } from "@/lib/game";

export function GameClient({ gameId }: { gameId: string }) {
  // Game metadata
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Streaming state for Claude's responses
  const [streamingSlot, setStreamingSlot] = useState<Slot | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const streamingSlotRef = useRef<Slot | null>(null);

  // Guess state
  const [guessLeft, setGuessLeft] = useState<Guess | null>(null);
  const [guessRight, setGuessRight] = useState<Guess | null>(null);
  const [submittingGuess, setSubmittingGuess] = useState(false);

  // Guess window timer origin (set client-side when status becomes guessing)
  const [guessingStartedAt, setGuessingStartedAt] = useState<string | null>(
    null
  );

  // Result state (fetched after game ends — safe to include claude_slot now)
  const [gameResult, setGameResult] = useState<{
    claudeSlot: Slot;
    guessCorrect: boolean | null;
    guessLeft: Guess | null;
    guessRight: Guess | null;
  } | null>(null);

  // UI
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  // ── Fetch initial game state ──────────────────────────────────
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
        if (data.started_at) setStartedAt(data.started_at);

        // If game was already in guessing when page loaded
        if (data.status === "guessing") {
          setGuessingStartedAt(new Date().toISOString());
        }
      });
  }, [gameId, supabase]);

  // ── Subscribe to game status changes ──────────────────────────
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
          const updated = payload.new as {
            status: string;
            started_at?: string;
          };
          setGameStatus(updated.status as GameStatus);
          if (updated.started_at) setStartedAt(updated.started_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // ── Subscribe to messages ─────────────────────────────────────
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

          if (
            newMsg.sender === "claude" &&
            newMsg.slot === streamingSlotRef.current
          ) {
            streamingSlotRef.current = null;
            setStreamingSlot(null);
            setStreamingContent("");
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const filtered = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("pending-") &&
                  m.sender === newMsg.sender &&
                  m.slot === newMsg.slot &&
                  m.content === newMsg.content
                )
            );
            return [...filtered, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // ── Fetch full game data when ended (reveals claude_slot) ─────
  useEffect(() => {
    if (gameStatus !== "ended") return;
    supabase
      .from("games")
      .select("claude_slot, guess_correct, p1_guess_left, p1_guess_right")
      .eq("id", gameId)
      .single()
      .then(({ data }) => {
        if (data) {
          setGameResult({
            claudeSlot: data.claude_slot as Slot,
            guessCorrect: data.guess_correct,
            guessLeft: data.p1_guess_left as Guess | null,
            guessRight: data.p1_guess_right as Guess | null,
          });
        }
      });
  }, [gameStatus, gameId, supabase]);

  // ── Handlers ──────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (slot: Slot, content: string) => {
      const pendingMsg: Message = {
        id: `pending-${Date.now()}-${slot}`,
        game_id: gameId,
        sender: "p1",
        slot,
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, pendingMsg]);

      const res = await fetch("/api/claude-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, slot, content }),
      });

      if (!res.ok) return;

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/plain") && res.body) {
        streamingSlotRef.current = slot;
        setStreamingSlot(slot);
        setStreamingContent("");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (streamingSlotRef.current !== slot) break;
            const chunk = decoder.decode(value, { stream: true });
            setStreamingContent((prev) => prev + chunk);
          }
        } finally {
          reader.releaseLock();
        }
      }
    },
    [gameId]
  );

  const handleChatTimerExpire = useCallback(() => {
    setGameStatus("guessing");
    setGuessingStartedAt(new Date().toISOString());
    supabase.from("games").update({ status: "guessing" }).eq("id", gameId);
  }, [gameId, supabase]);

  const handleGuessTimerExpire = useCallback(async () => {
    setSubmittingGuess(true);
    await fetch("/api/end-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, timeout: true }),
    });
  }, [gameId]);

  const handleSubmitGuess = useCallback(async () => {
    if (!guessLeft || !guessRight || submittingGuess) return;
    setSubmittingGuess(true);
    await fetch("/api/end-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, guessLeft, guessRight }),
    });
  }, [gameId, guessLeft, guessRight, submittingGuess]);

  const copyInviteUrl = useCallback(() => {
    const url = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [gameId]);

  // ── Derived state ─────────────────────────────────────────────

  const leftMessages = messages.filter((m) => m.slot === "left");
  const rightMessages = messages.filter((m) => m.slot === "right");

  const isActive =
    gameStatus === "ready" || gameStatus === "active";
  const isGuessing = gameStatus === "guessing";
  const isEnded = gameStatus === "ended";
  const chatDisabled = isGuessing || isEnded;
  const canSubmitGuess =
    !!guessLeft && !!guessRight && !submittingGuess && !isEnded;

  // ── Error state ───────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (gameStatus === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#555]">Loading game...</p>
      </main>
    );
  }

  // ── Waiting Lobby ─────────────────────────────────────────────
  if (gameStatus === "waiting") {
    const inviteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${gameId}`
        : `/join/${gameId}`;

    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 max-w-lg px-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              Waiting for opponent&hellip;
            </h1>
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

  // ── Active / Guessing / Ended — Dual Chat Panels ──────────────
  return (
    <main className="h-screen flex flex-col">
      {/* ── Header with timer ── */}
      <header className="shrink-0 px-6 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <h1 className="text-lg font-semibold">Turing Game</h1>

        {isActive && startedAt && (
          <CountdownTimer
            startedAt={startedAt}
            durationSeconds={GAME_DURATION_SECONDS}
            onExpire={handleChatTimerExpire}
          />
        )}

        {isGuessing && guessingStartedAt && (
          <CountdownTimer
            startedAt={guessingStartedAt}
            durationSeconds={GUESS_DURATION_SECONDS}
            onExpire={handleGuessTimerExpire}
            label="Guess"
          />
        )}

        {isEnded && (
          <span className="text-sm text-[#555] font-mono">Game Over</span>
        )}

        <span className="text-sm text-[#555] font-mono">{gameId}</span>
      </header>

      {/* ── Status banner ── */}
      {isGuessing && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-center">
          <p className="text-amber-400 text-sm font-medium">
            ⏰ Time&apos;s up! Make your guess before the timer runs out.
          </p>
        </div>
      )}

      {/* ── Chat panels ── */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel
            messages={leftMessages}
            streamingContent={
              streamingSlot === "left" ? streamingContent : undefined
            }
            onSend={(content) => sendMessage("left", content)}
            label="Witness A"
            currentSender="p1"
            disabled={chatDisabled || streamingSlot === "left"}
          />
          <GuessDropdown
            value={guessLeft}
            onChange={setGuessLeft}
            disabled={isEnded || submittingGuess}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatPanel
            messages={rightMessages}
            streamingContent={
              streamingSlot === "right" ? streamingContent : undefined
            }
            onSend={(content) => sendMessage("right", content)}
            label="Witness B"
            currentSender="p1"
            disabled={chatDisabled || streamingSlot === "right"}
          />
          <GuessDropdown
            value={guessRight}
            onChange={setGuessRight}
            disabled={isEnded || submittingGuess}
          />
        </div>
      </div>

      {/* ── Submit Guess button ── */}
      {!isEnded && (
        <div className="shrink-0 px-6 pb-4 flex justify-center">
          <button
            onClick={handleSubmitGuess}
            disabled={!canSubmitGuess}
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#2a2a2a] disabled:text-[#555] text-white font-medium rounded-xl transition-colors cursor-pointer disabled:cursor-default"
          >
            {submittingGuess ? "Submitting..." : "Submit Guess"}
          </button>
        </div>
      )}

      {/* ── Result overlay ── */}
      {isEnded && gameResult && (
        <ResultOverlay
          claudeSlot={gameResult.claudeSlot}
          guessCorrect={gameResult.guessCorrect}
          guessLeft={gameResult.guessLeft}
          guessRight={gameResult.guessRight}
        />
      )}
    </main>
  );
}
