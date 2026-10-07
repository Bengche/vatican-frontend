import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.name,
    short_name: brand.shortName,
    description: brand.seo.description,
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    dir: "ltr",
    categories: ["travel", "transportation"],
    background_color: brand.colors.primaryDark,
    theme_color: brand.colors.primary,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Book a trip",
        short_name: "Book",
        url: "/dashboard?source=shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "My tickets",
        short_name: "Tickets",
        url: "/my-bookings?source=shortcut",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/home-narrow.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "Search buses and choose your seat",
      },
      {
        src: "/screenshots/home-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Book intercity bus tickets online",
      },
    ],
  };
}
