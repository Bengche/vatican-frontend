import { brand } from "@/config/brand";

export const formatXAF = (amount: number | string | null | undefined) =>
  `${Number(amount || 0).toLocaleString("en-GB")} ${brand.currency}`;

// '2026-10-07' -> 'Wed 7 Oct 2026'
export function formatDate(value?: string | null): string {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value ?? "");
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// '07:30:00' -> '07:30'
export const formatTime = (value?: string | null) =>
  String(value ?? "").slice(0, 5);

export const shiftLabel = (shift?: string | null) =>
  shift === "evening"
    ? "Evening"
    : shift === "morning"
      ? "Morning"
      : "Scheduled";

export function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  });
}

/** Today as YYYY-MM-DD in Cameroon time. */
export const todayInCameroon = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(
    new Date(),
  );

export const toNationalPhone = (input: string): string | null => {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("237"))
    digits = digits.slice(3);
  return /^6\d{8}$/.test(digits) ? digits : null;
};
