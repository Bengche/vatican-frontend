import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify ticket", robots: { index: false } };

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
