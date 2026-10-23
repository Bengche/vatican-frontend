"use client";

import { usePathname } from "next/navigation";

// Staff screens are internal, so the notice is for public visitors only.
const HIDDEN_ON = ["/admin"];

/**
 * Informational notice shown at the top of every public page.
 * To remove it (for example once there is an agreement with Vatican Express),
 * delete the <DemoBanner /> line in app/layout.tsx.
 */
export default function DemoBanner() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <div
      role="note"
      aria-label="Important notice"
      className="no-print border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-medium leading-relaxed text-amber-950 sm:text-sm"
    >
      <strong className="font-bold uppercase tracking-wide">Notice:</strong> This is an independent demonstration
      of an online bus ticketing system. It is <strong>not</strong> the official Vatican Express website and is not
      affiliated with, endorsed by or operated by Vatican Express. Any partnership is still under discussion.
      Please do not make real bookings or payments on this site.
    </div>
  );
}
