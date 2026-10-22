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
  if (icon.kind === "default") {
    return (
      <>
        <img className="for-light" src="/brand/logo-tail-right-light.png" alt="" />
        <img className="for-dark" src="/brand/logo-tail-right-dark.png" alt="" />
      </>
    );
  }
  return <CompanyLogo src={icon.src} />;
}
