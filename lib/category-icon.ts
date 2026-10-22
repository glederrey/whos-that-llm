import { logoPublicUrl } from "./logos";
import { presentLogo } from "./rounds-shape";
import { publicEnv } from "./supabase/env";

/** What the page needs to draw a category icon. `src` is a logo URL, or the emoji itself. */
export type CategoryIconData = { kind: "logo" | "emoji"; src: string };

export function presentCategoryIcon(
  row: { icon_kind: string; icon_value: string },
  companyLogoPath: string | undefined,
): CategoryIconData | null {
  if (row.icon_kind === "emoji") return { kind: "emoji", src: row.icon_value };
  if (row.icon_kind === "company") {
    return companyLogoPath === undefined ? null : { kind: "logo", src: presentLogo(companyLogoPath, row.icon_value) };
  }
  if (row.icon_kind === "image") return { kind: "logo", src: logoPublicUrl(publicEnv()?.url ?? "", row.icon_value) };
  return null;
}
