export function clearedGameLink(): { user_id: null; username: null } {
  return { user_id: null, username: null };
}

export function clearedUsageLink(): { user_id: null } {
  return { user_id: null };
}

export type StoredGame = {
  id: string;
  userId: string | null;
  username: string | null;
};

export type StoredMessage = { id: string; gameId: string };
export type StoredGuess = { id: string; gameId: string };
export type StoredUsage = { id: string; gameId: string | null; userId: string | null };

export type StoredPlay = {
  games: StoredGame[];
  messages: StoredMessage[];
  guesses: StoredGuess[];
  usage: StoredUsage[];
};

export function anonymizePlay(play: StoredPlay, userId: string): StoredPlay {
  const game = clearedGameLink();
  const usage = clearedUsageLink();
  return {
    games: play.games.map((row) =>
      row.userId === userId ? { ...row, userId: game.user_id, username: game.username } : row,
    ),
    messages: play.messages,
    guesses: play.guesses,
    usage: play.usage.map((row) => (row.userId === userId ? { ...row, userId: usage.user_id } : row)),
  };
}

export type BoardGame = {
  userId: string | null;
  username: string | null;
  category: string;
  onBoard: boolean;
  status: string;
  score: number | null;
  messageCount: number;
  finishedAt: string | null;
};

export type BoardName = { rank: number; name: string; score: number; userId: string };

export function leaderboardNames(games: BoardGame[], category: string, since: string): BoardName[] {
  const best = new Map<string, BoardGame & { userId: string; username: string; score: number; finishedAt: string }>();
  for (const game of games) {
    if (game.userId === null || game.username === null || game.username.trim() === "") continue;
    if (!game.onBoard || game.category !== category) continue;
    if (game.status !== "solved" && game.status !== "miss") continue;
    if (game.score === null || game.finishedAt === null || game.finishedAt < since) continue;
    const row = {
      ...game,
      userId: game.userId,
      username: game.username,
      score: game.score,
      finishedAt: game.finishedAt,
    };
    const current = best.get(row.userId);
    if (!current || betterRound(row, current)) best.set(row.userId, row);
  }
  return [...best.values()]
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.messageCount !== b.messageCount) return a.messageCount - b.messageCount;
      if (a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
      if (a.username !== b.username) return a.username < b.username ? -1 : 1;
      return 0;
    })
    .map((game, index) => ({ rank: index + 1, name: game.username, score: game.score, userId: game.userId }));
}

function betterRound(
  next: { score: number; messageCount: number; finishedAt: string },
  current: { score: number; messageCount: number; finishedAt: string },
): boolean {
  if (next.score !== current.score) return next.score > current.score;
  if (next.messageCount !== current.messageCount) return next.messageCount < current.messageCount;
  return next.finishedAt < current.finishedAt;
}

export function countedRounds(games: { id: string }[]): number {
  return games.length;
}

export function countedPlayerId(userId: unknown): string | null {
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}
