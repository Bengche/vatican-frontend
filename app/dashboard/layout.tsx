import type { Metadata } from "next";
import PortalShell from "../components/PortalShell";

export const metadata: Metadata = { title: "Book a ticket", robots: { index: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
