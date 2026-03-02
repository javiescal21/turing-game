import { getGame } from "@/lib/game";
import type { Slot } from "@/lib/game";
import { JoinClient } from "./join-client";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = await getGame(gameId);

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 text-lg">Game not found</p>
      </main>
    );
  }

  if (game.status === "ended") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#888] text-lg">This game has already ended.</p>
      </main>
    );
  }

  const p2Slot: Slot = game.claude_slot === "left" ? "right" : "left";

  return (
    <JoinClient
      gameId={gameId}
      p2Slot={p2Slot}
      initialStatus={game.status}
    />
  );
}
