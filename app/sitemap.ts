import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/login", "/register"].map((path) => ({ url: `${brand.siteUrl}${path}`, changeFrequency: "weekly" }));
}
