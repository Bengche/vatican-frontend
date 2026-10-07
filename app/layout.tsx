import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Newsreader, Public_Sans } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";
import PwaProvider from "./components/PwaProvider";

const sans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.name} | ${brand.seo.title}`,
    template: `%s | ${brand.name}`,
  },
  description: brand.seo.description,
  keywords: [...brand.seo.keywords],
  applicationName: brand.name,
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: `${brand.name} | ${brand.seo.title}`,
    description: brand.seo.description,
    siteName: brand.name,
    locale: "en_CM",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: brand.colors.primary,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const brandVariables = {
  "--brand-primary": brand.colors.primary,
  "--brand-primary-dark": brand.colors.primaryDark,
  "--brand-accent": brand.colors.accent,
  "--brand-accent-dark": brand.colors.accentDark,
  "--brand-accent-soft": brand.colors.accentSoft,
} as CSSProperties;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable}`}
      style={brandVariables}
    >
      <body className="flex min-h-dvh flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
