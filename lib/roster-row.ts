import type { CategoryIconData } from "./category-icon";
import type { Difficulty } from "./difficulty";
import type { Origin, Size } from "./game";

export type RosterRow = {
  id: string;
  openrouterId: string;
  name: string;
  companyId: string;
  companyName: string;
  origin: Origin;
  year: string;
  size: Size;
  difficulty: Difficulty | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
  enabled: boolean;
  available: boolean;
  /** A reasoning model. Only these can have reasoning turned off. */
  reasoning: boolean;
  reasoningOff: boolean;
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
  enabled: boolean;
};
