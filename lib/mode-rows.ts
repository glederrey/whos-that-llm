export type ModeRow = {
  id: string;
  name: string;
  games: number;
  open: number;
  finished: number;
  solved: number;
  solveRate: number | null;
  givenUp: number;
};

const OPEN = "active";
const SOLVED = "solved";
const MISSED = "miss";
const GAVE_UP = "given_up";
const finishedStatus = new Set([SOLVED, MISSED, GAVE_UP]);

export function modeRows(
  games: { category: string; status: string }[],
  categories: { id: string; name: string }[],
): ModeRow[] {
  const ids = categories.map((category) => category.id);
  for (const game of games) {
    if (game.category && !ids.includes(game.category)) ids.push(game.category);
  }
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return ids.map((id) => {
    const rows = games.filter((game) => game.category === id);
    const finished = rows.filter((game) => finishedStatus.has(game.status)).length;
    const solved = rows.filter((game) => game.status === SOLVED).length;
    return {
      id,
      name: names.get(id) ?? id,
      games: rows.length,
      open: rows.filter((game) => game.status === OPEN).length,
      finished,
      solved,
      solveRate: finished > 0 ? solved / finished : null,
      givenUp: rows.filter((game) => game.status === GAVE_UP).length,
    };
  });
}
