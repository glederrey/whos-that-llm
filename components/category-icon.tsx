import type { CategoryIconData } from "@/lib/category-icon";
import { CompanyLogo } from "./company-logo";

export function CategoryIcon({ icon }: { icon: CategoryIconData | null }) {
  if (!icon) return null;
  if (icon.kind === "emoji") {
    return (
      <span className="category-emoji" aria-hidden="true">
        {icon.src}
      </span>
    );
  }
  return <CompanyLogo src={icon.src} />;
}
