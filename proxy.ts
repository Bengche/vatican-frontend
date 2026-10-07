import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canVisit, homeFor, isStaffRole } from "@/lib/roles";

const PROTECTED_PREFIXES = ["/dashboard", "/my-bookings", "/admin"];
const AUTH_ROUTES = ["/login", "/register"];

function readSession(token?: string): { valid: boolean; role: string } {
  if (!token) return { valid: false, role: "passenger" };
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp, role } = JSON.parse(atob(payload));
    return {
      valid: Boolean(exp) && exp > Math.floor(Date.now() / 1000),
      role: role || "passenger",
    };
  } catch {
    return { valid: false, role: "passenger" };
  }
}

// Convenience guard only; every API call is authorised again on the server.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const session = readSession(token);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected && !session.valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete("token");
    return response;
  }

  if (
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    !(isStaffRole(session.role) && canVisit(session.role, pathname))
  ) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }

  if (isAuthRoute && session.valid) {
    const redirect = request.nextUrl.searchParams.get("redirect");
    return NextResponse.redirect(
      new URL(
        redirect && redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : homeFor(session.role),
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
