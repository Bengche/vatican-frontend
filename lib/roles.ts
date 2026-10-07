// Role helpers shared by the route guard, the layouts and the pages.
// Safe to import from both server and client code (no browser APIs).

export const ADMIN_ROLES = ["agency_admin", "super_admin"];
export const STAFF_ROLES = [...ADMIN_ROLES, "counter_agent", "gateman"];

export const isAdminRole = (role?: string | null) =>
  Boolean(role && ADMIN_ROLES.includes(role));

export const isStaffRole = (role?: string | null) =>
  Boolean(role && STAFF_ROLES.includes(role));

/** Console areas each non-administrator role may open. */
const STAFF_AREAS: Record<string, string[]> = {
  counter_agent: ["/admin/counter-booking", "/admin/cash", "/admin/boarding"],
  gateman: ["/admin/boarding"],
};

export function canVisit(role: string | undefined | null, pathname: string) {
  if (isAdminRole(role)) return true;
  const areas = role ? STAFF_AREAS[role] : undefined;
  return Boolean(
    areas?.some((area) => pathname === area || pathname.startsWith(`${area}/`)),
  );
}

/** Where a signed-in user lands by default. */
export function homeFor(role?: string | null) {
  if (isAdminRole(role)) return "/admin/dashboard";
  if (role === "counter_agent") return "/admin/counter-booking";
  if (role === "gateman") return "/admin/boarding";
  return "/dashboard";
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrator",
  agency_admin: "Administrator",
  counter_agent: "Counter agent",
  gateman: "Boarding agent",
  passenger: "Passenger",
};