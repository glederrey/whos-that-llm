import type { GameStatus } from "./game";

const maxAvatarBytes = 1024 * 1024;

export const avatarError = "Use a JPEG, PNG, or WebP under 1 MB.";

const avatarMimes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const imageKinds = [
  { mime: "image/jpeg", ext: "jpg", test: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    test: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (bytes: Uint8Array) =>
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
] as const;

export type CountedGame = {
  status: GameStatus;
  score: number | null;
  messageCount: number;
};

export type ProfileStats = {
  played: number;
  solved: number;
  missed: number;
  givenUp: number;
  solveRate: number | null;
  best: number | null;
  average: number | null;
  averageMessages: number | null;
};

export function cleanUsername(raw: string): string | null {
  const username = raw.trim();
  if (username.length < 3 || username.length > 20 || /[\n\r]/.test(username)) return null;
  return username;
}

export function profileStats(games: CountedGame[]): ProfileStats {
  const solvedGames = games.filter((game) => game.status === "solved");
  const missed = games.filter((game) => game.status === "miss").length;
  const givenUp = games.filter((game) => game.status === "given_up").length;
  const finished = solvedGames.length + missed + givenUp;
  const scored = games.flatMap((game) => (game.score === null ? [] : [game.score]));
  return {
    played: games.length,
    solved: solvedGames.length,
    missed,
    givenUp,
    solveRate: finished === 0 ? null : solvedGames.length / finished,
    best: scored.length === 0 ? null : Math.max(...scored),
    average: scored.length === 0 ? null : scored.reduce((sum, score) => sum + score, 0) / scored.length,
    averageMessages:
      solvedGames.length === 0
        ? null
        : solvedGames.reduce((sum, game) => sum + game.messageCount, 0) / solvedGames.length,
  };
}

export function traitFound(input: {
  status: GameStatus;
  given: string[];
  companyCorrect: boolean;
  regionCorrect: boolean;
  trait: "company" | "region";
}): boolean {
  if (input.status === "solved") return true;
  if (input.given.includes(input.trait)) return true;
  return input.trait === "company" ? input.companyCorrect : input.regionCorrect;
}

export function avatarPublicUrl(baseUrl: string, path: string | null): string | null {
  if (!path) return null;
  const safe = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/${safe}`;
}

export function avatarFileError(file: { size: number; type: string }): string | null {
  const type = file.type.toLowerCase();
  if (file.size > maxAvatarBytes || (type !== "" && !avatarMimes.has(type))) return avatarError;
  return null;
}

export function readImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.byteLength === 0 || bytes.byteLength > maxAvatarBytes || bytes.byteLength < 12) return null;
  const kind = imageKinds.find((item) => item.test(bytes));
  return kind ? { mime: kind.mime, ext: kind.ext } : null;
}
