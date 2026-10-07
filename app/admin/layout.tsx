"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "../components/Logo";
import { api } from "@/lib/api";
import { isAdmin, isStaff, signOut, useUser } from "@/lib/auth";
import { ROLE_LABELS, canVisit, homeFor } from "@/lib/roles";

const ICONS = {
  overview: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  bookings:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4",
  counter:
    "M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8zm12-2v12",
  cash: "M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h14a1 1 0 001-1v-9a1 1 0 00-1-1H5a2 2 0 01-2-2zm14 7h.01",
  boarding: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  schedule:
    "M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  fleet: "M4 6h16v9H4V6zm0 5h16M7 18.5h.01M17 18.5h.01M6 15v3m12-3v3",
  terminals:
    "M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16m0 0h4V10a1 1 0 00-1-1h-3M9 8h2m-2 4h2m-2 4h2",
  payouts: "M3 7h18v10H3V7zm9 7a2 2 0 100-4 2 2 0 000 4zM6 10h.01M18 14h.01",
  staff:
    "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
};

const NAV = [
  { label: "Overview", href: "/admin/dashboard", icon: ICONS.overview },
  { label: "Bookings", href: "/admin/bookings", icon: ICONS.bookings },
  {
    label: "Counter sales",
    href: "/admin/counter-booking",
    icon: ICONS.counter,
  },
  { label: "Cash", href: "/admin/cash", icon: ICONS.cash },
  { label: "Boarding", href: "/admin/boarding", icon: ICONS.boarding },
  { label: "Departures", href: "/admin/schedules", icon: ICONS.schedule },
  { label: "Fleet and notices", href: "/admin/fleet", icon: ICONS.fleet },
  { label: "Terminals", href: "/admin/agencies", icon: ICONS.terminals },
  { label: "Payouts", href: "/admin/payouts", icon: ICONS.payouts },
  { label: "Staff", href: "/admin/staff", icon: ICONS.staff },
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
  const [payoutAlerts, setPayoutAlerts] = useState(0);

  const allowed = isStaff(user) && canVisit(user?.role, pathname);
  const admin = isAdmin(user);

  useEffect(() => {
    if (user === undefined) return;
    if (!isStaff(user)) router.replace("/dashboard");
    else if (!canVisit(user?.role, pathname))
      router.replace(homeFor(user?.role));
  }, [user, pathname, router]);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    api
      .get("/admin/payouts/summary")
      .then(({ data }) => {
        if (active)
          setPayoutAlerts(Number(data.failed || 0) + Number(data.stuck || 0));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [admin, pathname]);

  if (!allowed) return <div className="min-h-dvh bg-slate-50" />;

  const items = NAV.filter((item) => canVisit(user?.role, item.href));
  const consoleName = admin ? "Admin console" : "Staff console";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href={homeFor(user?.role)}>
          <Logo subtitle={consoleName} />
        </Link>
      </div>
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3"
        aria-label={consoleName}
      >
        {items.map((item) => {
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
              {item.href === "/admin/payouts" && payoutAlerts > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {payoutAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">
          {user?.name || "Staff"}
        </p>
        <p className="truncate text-xs text-slate-400">
          {ROLE_LABELS[user?.role ?? ""] ?? user?.email ?? user?.phone_number}
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
