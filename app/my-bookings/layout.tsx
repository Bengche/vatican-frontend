import type { Metadata } from "next";
import PortalShell from "../components/PortalShell";

export const metadata: Metadata = {
  title: "My tickets",
  robots: { index: false },
};

export default function MyBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
