"use client";

import { useEffect, useState } from "react";

export interface SessionUser {
  id: number | string;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  role?: string;
}

const ADMIN_ROLES = ["agency_admin", "super_admin"];
export const isAdmin = (user?: SessionUser | null) =>
  Boolean(user?.role && ADMIN_ROLES.includes(user.role));

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : localStorage.getItem("token");

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // The cookie lets the route guard (proxy) recognise the session; API calls use the stored token.
  document.cookie = `token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("session-change"));
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = "token=; path=/; max-age=0; SameSite=Lax";
  window.dispatchEvent(new Event("session-change"));
}

/** Current user; `undefined` until the browser storage has been read. */
export function useUser(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setUser(getToken() ? getUser() : null);
    sync();
    window.addEventListener("session-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("session-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return user;
}
