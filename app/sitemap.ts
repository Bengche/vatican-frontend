import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { fetchPublic } from "@/lib/server";
import type { RoutePage } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await fetchPublic<{ routes: RoutePage[] }>("/route-pages", 3600);

  const pages = [
    { path: "", priority: 1 },
    { path: "/bus", priority: 0.9 },
    { path: "/login", priority: 0.3 },
    { path: "/register", priority: 0.4 },
    { path: "/terms", priority: 0.2 },
    { path: "/privacy", priority: 0.2 },
    { path: "/refund-policy", priority: 0.2 },
    ...(data?.routes ?? []).map((route) => ({ path: `/bus/${route.slug}`, priority: 0.8 })),
  ];

  return pages.map(({ path, priority }) => ({
    url: `${brand.siteUrl}${path}`,
    changeFrequency: "weekly" as const,
    priority,
  }));
}