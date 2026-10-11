import type { MetadataRoute } from "next";
import { publicPageUrl, publicPaths } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({ url: publicPageUrl(path) }));
}
