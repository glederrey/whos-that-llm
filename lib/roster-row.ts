import type { CategoryIconData } from "./category-icon";
import type { Difficulty } from "./difficulty";
import type { Region, Size } from "./game";

export type RosterRow = {
  id: string;
  openrouterId: string;
  name: string;
  companyName: string;
  region: Region;
  year: string;
  size: Size;
  difficulty: Difficulty | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  enabled: boolean;
  available: boolean;
  logoUrl: string;
  categoryIds: string[];
  categoryNames: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  iconKind: string;
  iconValue: string;
  icon: CategoryIconData | null;
};
