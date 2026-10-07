"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { isAdmin, signOut, useUser } from "@/lib/auth";
import { requestInstall, useInstall } from "@/lib/pwa";

interface NavLink {
  label: string;
  href: string;
}

const MARKETING_LINKS: NavLink[] = [
  { label: "Departures", href: "/#departures" },
  { label: "How it works", href: "/#how" },
  { label: "Terminals", href: "/#terminals" },
  { label: "Contact", href: "/#contact" },
];

const MEMBER_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Book a trip", href: "/dashboard" },
  { label: "My tickets", href: "/my-bookings" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const user = useUser();
  const { canInstall } = useInstall();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const links = user ? MEMBER_LINKS : MARKETING_LINKS;
  const admin = isAdmin(user);
  const displayName = user?.name || user?.phone_number || "Account";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      )
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleSignOut = () => {
    setProfileOpen(false);
    setMenuOpen(false);
    signOut();
  };

  const isActive = (href: string) =>
    !href.includes("#") &&
    (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-primary pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                isActive(link.href)
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {admin && (
            <Link
              href="/admin/dashboard"
              className="ml-1 rounded-lg px-3.5 py-2 text-sm font-semibold text-accent transition hover:bg-white/5"
            >
              Admin console
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user === undefined ? null : user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary-dark">
                  {initials || "U"}
                </span>
                <span className="max-w-32 truncate">
                  {displayName.split(" ")[0]}
                </span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-slate-800 shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email || user.phone_number}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    Book a trip
                  </Link>
                  <Link
                    href="/my-bookings"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    My tickets
                  </Link>
                  {admin && (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm font-semibold text-accent-dark hover:bg-slate-50"
                    >
                      Admin console
                    </Link>
                  )}
                  {canInstall && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        void requestInstall();
                      }}
                      className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                    >
                      Install app
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white"
              >
                Sign in
              </Link>
              <Link href="/register" className="btn btn-accent btn-sm">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white md:hidden"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            viewBox="0 0 24 24"
          >
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-primary px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-3 text-base font-medium ${isActive(link.href) ? "bg-white/10 text-white" : "text-slate-200"}`}
              >
                {link.label}
              </Link>
            ))}
            {admin && (
              <Link
                href="/admin/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-semibold text-accent"
              >
                Admin console
              </Link>
            )}
          </nav>
          {canInstall && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void requestInstall();
              }}
              className="mt-2 w-full rounded-lg border border-white/15 px-3 py-3 text-left text-base font-medium text-slate-200"
            >
              Install app
            </button>
          )}
          <div className="mt-3 border-t border-white/10 pt-4">
            {user === undefined ? null : user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {user.email || user.phone_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn btn-sm border border-white/20 text-white hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn border border-white/20 text-white hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="btn btn-accent"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
