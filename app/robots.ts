import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/my-bookings", "/verify", "/reset-password", "/forgot-password"] },
    sitemap: `${brand.siteUrl}/sitemap.xml`,
  };
}
