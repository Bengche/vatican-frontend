import axios from "axios";
import { api } from "@/lib/api";
import * as store from "./db";
import type { LocalBooking, LocalTrip, TicketKey } from "./db";
import { checkSignature, parseScan } from "./qr";

const TIME_ZONE = "Africa/Douala";
const CHANGE_EVENT = "gate-offline-change";
const MAX_ISSUES = 50;

export class DeviceRevokedError extends Error {
  constructor() {
    super("This device has been disabled by an administrator.");
  }
}

export class DeviceMissingError extends Error {
  constructor() {
    super("This device is not registered.");
  }
}

export type ScanKind =
  | "ok"
  | "unlisted"
  | "already"
  | "cancelled"
  | "wrong-day"
  | "unknown-trip"
  | "forged"
  | "unknown";

export interface ScanResult {
  kind: ScanKind;
  message: string;
  booking: LocalBooking | null;
  trip: LocalTrip | null;
  canBoard: boolean;
  /** An administrator may still let a ticket for another day through. */
  canOverride: boolean;
}

export interface SyncIssue {
  id: string;
  ref: string;
  result: string;
  detail: string;
  at: number;
}

export interface GateStatus {
  pending: number;
  bundleAt: number | null;
  bookings: number;
  issues: SyncIssue[];
  /** How far this phone's clock was from the server's at the last contact (ms, positive = server ahead). */
  clockOffsetMs: number;
}

const emit = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export const onGateChange = (listener: () => void) => {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
};

function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The server's idea of "now", so a wrong phone clock cannot break the date checks. */
async function trustedNow() {
  const offset = (await store.getMeta<number>("serverOffsetMs")) ?? 0;
  return Date.now() + offset;
}

const dayOf = (ms: number) =>
  new Date(ms).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

const errorCode = (error: unknown) =>
  axios.isAxiosError(error)
    ? (error.response?.data as { code?: string } | undefined)?.code
    : undefined;

async function deviceHeaders(userId: string) {
  const deviceId = await store.getMeta<string>(`device:${userId}`);
  if (!deviceId) throw new DeviceMissingError();
  // The server records how far this phone's clock is off and how many boardings still wait to upload.
  return {
    "X-Device-Id": deviceId,
    "X-Client-Time": String(Date.now()),
    "X-Pending": String(await store.countQueue()),
  };
}

async function handleDeviceError(userId: string, error: unknown): Promise<never> {
  const code = errorCode(error);
  if (code === "DEVICE_REVOKED") {
    await store.clearReferenceData();
    await store.setMeta(`revoked:${userId}`, true);
    emit();
    throw new DeviceRevokedError();
  }
  if (code === "DEVICE_UNKNOWN" || code === "DEVICE_REQUIRED") {
    await store.deleteMeta(`device:${userId}`);
    emit();
    throw new DeviceMissingError();
  }
  throw error;
}

export const getDeviceId = (userId: string) =>
  store.getMeta<string>(`device:${userId}`);

export const isRevoked = async (userId: string) =>
  Boolean(await store.getMeta<boolean>(`revoked:${userId}`));

export async function registerDevice(userId: string, label: string) {
  const { data } = await api.post("/admin/devices/register", { label });
  await store.deleteMeta(`revoked:${userId}`);
  await store.setMeta(`device:${userId}`, data.device.id);
  emit();
}

/** Cheap check that this device is still allowed to work; also keeps the clock offset fresh. */
export async function ping(userId: string) {
  const headers = await deviceHeaders(userId);
  try {
    const { data } = await api.get("/admin/gate/offline/ping", { headers, timeout: 15_000 });
    await store.setMeta("serverOffsetMs", Date.parse(data.serverTime) - Date.now());
  } catch (error) {
    return handleDeviceError(userId, error);
  }
}

/** Downloads the keys, departures and tickets needed to scan with no network. */
export async function downloadBundle(userId: string, days = 3) {
  const headers = await deviceHeaders(userId);
  try {
    const { data } = await api.get("/admin/gate/offline/bundle", {
      headers,
      params: { days },
      timeout: 120_000,
    });
    await store.replaceBundle({
      trips: data.trips,
      bookings: data.bookings,
      keys: data.keys as TicketKey[],
      serverOffsetMs: Date.parse(data.serverTime) - Date.now(),
    });
    emit();
  } catch (error) {
    return handleDeviceError(userId, error);
  }
}

let flushing: Promise<number> | null = null;

/** Sends saved boardings to the server. Safe to call at any time; resolves with how many were sent. */
export function flushQueue(userId: string): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    const headers = await deviceHeaders(userId);
    let sent = 0;
    try {
      for (;;) {
        const batch = (await store.listQueue()).slice(0, 200);
        if (batch.length === 0) break;

        const { data } = await api.post(
          "/admin/gate/offline/sync",
          {
            boardings: batch.map(({ id, hash, scannedAt }) => ({ id, hash, scannedAt })),
          },
          { headers, timeout: 60_000 },
        );

        const byId = new Map(batch.map((entry) => [entry.id, entry]));
        const issues: SyncIssue[] = [];
        for (const result of data.results as {
          id: string;
          result: string;
          detail?: string;
        }[]) {
          const entry = byId.get(result.id);
          if (!entry) continue;
          if (result.result !== "applied" && result.result !== "pending") {
            issues.push({
              id: entry.id,
              ref: entry.ref,
              result: result.result,
              detail: result.detail ?? "",
              at: Date.now(),
            });
          }
          if (result.result === "applied" || result.result === "duplicate") {
            await store.markBoarded(entry.hash, entry.scannedAt);
          }
        }

        // Anything the server answered about (even a rejection) is done; the rest stays queued.
        const answered = new Set<string>(
          (data.results as { id: string; result: string }[])
            .filter((r) => r.result !== "pending")
            .map((r) => r.id),
        );
        const handled = batch.filter((entry) => answered.has(entry.id));
        if (handled.length === 0) break;
        await store.removeFromQueue(handled.map((entry) => entry.id));
        sent += handled.length;

        if (issues.length) {
          const previous = (await store.getSecureMeta<SyncIssue[]>("issues")) ?? [];
          await store.setSecureMeta("issues", [...issues, ...previous].slice(0, MAX_ISSUES));
        }
        emit();
      }
      return sent;
    } catch (error) {
      return handleDeviceError(userId, error);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function dismissIssues() {
  await store.setSecureMeta("issues", []);
  emit();
}

export async function getStatus(): Promise<GateStatus> {
  const [pending, bundleAt, bookings, issues, offset] = await Promise.all([
    store.countQueue(),
    store.getMeta<number>("bundleAt"),
    store.countBookings(),
    // Issues are encrypted; while the device is locked they are simply not shown.
    store.getSecureMeta<SyncIssue[]>("issues").catch(() => undefined),
    store.getMeta<number>("serverOffsetMs"),
  ]);
  return {
    pending,
    bundleAt: bundleAt ?? null,
    bookings,
    issues: issues ?? [],
    clockOffsetMs: offset ?? 0,
  };
}

const blocked = (
  kind: ScanKind,
  message: string,
  booking: LocalBooking | null = null,
  trip: LocalTrip | null = null,
  canOverride = false,
): ScanResult => ({ kind, message, booking, trip, canBoard: false, canOverride });

/** Decides what the gate should do with a scanned or typed ticket, using only data on this device. */
export async function evaluate(
  text: string,
  options: { admin: boolean },
): Promise<ScanResult> {
  const scan = parseScan(text);
  if (!scan.hash && !scan.ref) {
    return blocked("unknown", "Nothing was read. Try scanning again.");
  }

  const keys = (await store.getMeta<TicketKey[]>("keys")) ?? [];
  let booking = scan.hash
    ? await store.getBookingByHash(scan.hash)
    : scan.ref
      ? await store.getBookingByRef(scan.ref)
      : undefined;
  let unlisted = false;

  if (booking) {
    if (
      (scan.ref && scan.ref.toUpperCase() !== booking.ref.toUpperCase()) ||
      (scan.tripId && scan.tripId !== booking.trip_id && scan.tripId !== booking.qr_trip)
    ) {
      return blocked("forged", "This ticket does not match our records. Do not board.");
    }
  } else if (scan.hash) {
    const signature = checkSignature(scan, keys);
    if (signature === "invalid") {
      return blocked("forged", "This ticket failed the security check. Do not board.");
    }
    if (signature !== "valid") {
      return blocked(
        "unknown",
        "This ticket is not on this device and cannot be checked offline. Connect to the internet and try again.",
      );
    }
    const trip = await store.getTrip(scan.tripId!);
    if (!trip) {
      return blocked(
        "unknown-trip",
        "Genuine ticket, but its departure is not on this device. Connect to the internet to download it.",
      );
    }
    unlisted = true;
    booking = {
      id: "",
      hash: scan.hash,
      ref: scan.ref!,
      trip_id: trip.id,
      status: "confirmed",
      boarded: false,
      boarded_at: null,
      passengers: [],
    };
  } else {
    return blocked(
      "unknown",
      "No ticket with that reference on this device. If it was sold recently, connect to the internet and download the latest data.",
    );
  }

  const trip = (await store.getTrip(booking.trip_id)) ?? null;

  if (booking.status !== "confirmed") {
    return blocked("cancelled", "This ticket was cancelled or refunded. Do not board.", booking, trip);
  }
  if (booking.boarded) {
    return blocked("already", "This ticket has already been used to board.", booking, trip);
  }
  if (trip && trip.travel_date !== dayOf(await trustedNow())) {
    return blocked(
      "wrong-day",
      `This ticket is for ${trip.travel_date}, not today.`,
      booking,
      trip,
      options.admin,
    );
  }

  return {
    kind: unlisted ? "unlisted" : "ok",
    message: unlisted
      ? "Genuine ticket, sold after this device last downloaded its list. It will be confirmed when you sync."
      : "Valid ticket.",
    booking,
    trip,
    canBoard: true,
    canOverride: false,
  };
}

/** Records a boarding on this device and sends it to the server as soon as a connection allows. */
export async function board(userId: string, result: ScanResult) {
  if (!result.booking) return;
  const entry = {
    id: uuid(),
    hash: result.booking.hash,
    ref: result.booking.ref,
    scannedAt: new Date(await trustedNow()).toISOString(),
    created: Date.now(),
  };
  await store.saveBoarding(entry, result.kind !== "unlisted");
  emit();
  if (navigator.onLine) flushQueue(userId).catch(() => {});
}

export { searchBookings } from "./db";
