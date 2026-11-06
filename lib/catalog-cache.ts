import { revalidateTag } from "next/cache";

/**
 * Tags for the cached player-facing config reads (rounds-start.ts). The 300 s `revalidate` on each
 * cache is only a safety net: every write to models, companies, categories, model_categories or
 * origins must call `refreshCatalog()` so players never see a stale roster after an admin edit.
 * game_modes has no write path in the app (the modes page is read-only), so it only expires on time.
 */
export const catalogTag = "catalog";
export const gameModesTag = "game-modes";
export const catalogRevalidateSeconds = 300;
export const gameModesRevalidateSeconds = 60;

/** Expire the cached catalog, board options and lobby config now (not stale-while-revalidate). */
export function refreshCatalog(): void {
  try {
    revalidateTag(catalogTag, { expire: 0 });
  } catch (error) {
    // Outside a Next request (a script, a test) there is nothing cached to expire.
    console.error("catalog cache refresh failed", error);
  }
}
