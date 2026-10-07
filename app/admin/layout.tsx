"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "../components/Logo";
import { isAdmin, signOut, useUser } from "@/lib/auth";

const ICONS = {
  overview: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  counter:
    "M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8zm12-2v12",
  schedule:
    "M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  fleet: "M4 6h16v9H4V6zm0 5h16M7 18.5h.01M17 18.5h.01M6 15v3m12-3v3",
  terminals:
    "M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16m0 0h4V10a1 1 0 00-1-1h-3M9 8h2m-2 4h2m-2 4h2",
};

const NAV = [
  { label: "Overview", href: "/admin/dashboard", icon: ICONS.overview },
  {
    label: "Counter sales",
    href: "/admin/counter-booking",
    icon: ICONS.counter,
  },
  { label: "Departures", href: "/admin/schedules", icon: ICONS.schedule },
  { label: "Fleet and notices", href: "/admin/fleet", icon: ICONS.fleet },
  { label: "Terminals", href: "/admin/agencies", icon: ICONS.terminals },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user !== undefined && !isAdmin(user)) router.replace("/dashboard");
  }, [user, router]);


  if (!isAdmin(user)) return <div className="min-h-dvh bg-slate-50" />;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/admin/dashboard">
          <Logo subtitle="Admin console" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Admin">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <svg
                className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">
          {user?.name || "Administrator"}
        </p>
        <p className="truncate text-xs text-slate-400">
          {user?.email || user?.phone_number}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/dashboard"
            className="btn btn-sm border border-white/15 text-slate-200 hover:bg-white/10"
          >
            Website
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="btn btn-sm border border-white/15 text-slate-200 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh bg-primary lg:block">
        {sidebar}
      </aside>

      <div className="sticky top-0 z-40 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between bg-primary px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Logo subtitle="" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            viewBox="0 0 24 24"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-primary pt-[env(safe-area-inset-top)] shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
