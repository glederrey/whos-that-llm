import type { SupabaseClient } from "@supabase/supabase-js";
import { presentCategoryIcon } from "./category-icon";
import type { CategoryRow } from "./roster-row";

/** Every category by name, with its icon ready to draw. Null when a read fails. */
export async function loadCategoryEntries(client: SupabaseClient): Promise<CategoryRow[] | null> {
  const [categories, companies] = await Promise.all([
    client.from("categories").select("id, name, description, icon_kind, icon_value").order("name"),
    client.from("companies").select("id, logo_path"),
  ]);
  if (categories.error || companies.error) return null;
  const logos = new Map((companies.data ?? []).map((row) => [row.id as string, (row.logo_path as string | null) ?? ""]));
  return (categories.data ?? []).map((row) => {
    const iconKind = row.icon_kind as string;
    const iconValue = row.icon_value as string;
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      iconKind,
      iconValue,
      icon: presentCategoryIcon({ icon_kind: iconKind, icon_value: iconValue }, logos.get(iconValue)),
    };
  });
}
