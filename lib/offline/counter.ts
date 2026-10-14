import nacl from "tweetnacl";
import { api, API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { brand } from "@/config/brand";
import type { Seat } from "@/lib/types";
import * as store from "./counterDb";
import type {
  CounterBus,
  CounterRoute,
  CounterSale,
  CounterTrip,
  SalePassenger,
} from "./counterDb";

const TIME_ZONE = "Africa/Douala";
const CHANGE_EVENT = "counter-offline-change";
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEEP_SYNCED_MS = 3 * 86_400_000;

export class CounterDeviceRevokedError extends Error {
  constructor() {
    super("This device has been disabled by an administrator.");
  }
}

export class CounterDeviceMissingError extends Error {
  constructor() {
    super("This device is not registered.");
  }
}

export class SaleRefusedError extends Error {}

export interface CounterSetup {
  deviceId: string;
  code: string;
  keyId: string;
}

export interface CounterStatus {
  pending: number;
  needsAttention: number;
  bundleAt: number | null;
  trips: number;
  parkName: string | null;
}

export interface SellInput {
  trip: CounterTrip;
  passengers: SalePassenger[];
  phone: string;
  payment: { method: "cash" | "momo"; ref?: string };
  lateEntry?: { paperRef: string; soldAt: string } | null;
}

export type SellOutcome = {
  sale: CounterSale;
  /** synced: the server has it. queued: saved on this device, will upload. */
  status: "synced" | "queued";
};

const emit = () => window.dispatchEvent(new Event(CHANGE_EVENT));

interface BundleTrip {
  id: string;
  clientId: string | null;
  routeId: string;
  busId: string;
  busNumber: string;
  travelDate: string;
  departureTime: string;
  fare: number;
  originCity: string;
  destinationCity: string;
  taken?: string[];
}

export const onCounterChange = (listener: () => void) => {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
};

/* ------------------------------ helpers ------------------------------ */

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const randomHash = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");

/** Ticket numbers are made on the device: <prefix>-0<device code><4 characters counting up>. */
export function referenceFor(prefix: string, code: string, seq: number) {
  let n = seq;
  let tail = "";
  for (let i = 0; i < 4; i += 1) {
    tail = REF_ALPHABET[n % 32] + tail;
    n = Math.floor(n / 32);
  }
  if (n > 0) throw new Error("This device has used all of its ticket numbers. Contact your administrator.");
  return `${prefix}-0${code}${tail}`;
}

const errorCode = (error: unknown) =>
  (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

async function trustedNow() {
  const offset = (await store.getMeta<number>("serverOffsetMs")) ?? 0;
  return Date.now() + offset;
}

export const dayOf = (ms: number) =>
  new Date(ms).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

const departureMs = (trip: { travelDate: string; departureTime: string }) =>
  Date.parse(`${trip.travelDate}T${trip.departureTime.slice(0, 5)}:00+01:00`);

/* ------------------------------- setup ------------------------------- */

export async function getSetup(userId: string): Promise<CounterSetup | null> {
  const deviceId = await store.getMeta<string>(`device:${userId}`);
  const code = await store.getMeta<string>(`code:${userId}`);
  return deviceId && code ? { deviceId, code, keyId: `c${code}` } : null;
}

export const isRevoked = async (userId: string) =>
  Boolean(await store.getMeta<boolean>(`revoked:${userId}`));

/** Makes this device's own signing key, enrols it with the server and remembers the result. */
export async function registerCounter(userId: string, label: string, parkId: string) {
  const pair = nacl.sign.keyPair();
  const { data } = await api.post("/admin/devices/register", {
    label,
    kind: "counter",
    parkId,
    publicKey: toBase64Url(pair.publicKey),
  });
  await store.setMeta(`secret:${userId}`, toBase64(pair.secretKey));
  await store.setMeta(`device:${userId}`, data.device.id);
  await store.setMeta(`code:${userId}`, data.device.code);
  await store.deleteMeta(`revoked:${userId}`);
  emit();
}

async function headersFor(userId: string) {
  const setup = await getSetup(userId);
  if (!setup) throw new CounterDeviceMissingError();
  return { "X-Device-Id": setup.deviceId };
}

async function handleDeviceError(userId: string, error: unknown): Promise<never> {
  const code = errorCode(error);
  if (code === "DEVICE_REVOKED") {
    await store.clearReferenceData();
    await store.setMeta(`revoked:${userId}`, true);
    emit();
    throw new CounterDeviceRevokedError();
  }
  if (code === "DEVICE_UNKNOWN" || code === "DEVICE_REQUIRED") {
    await store.deleteMeta(`device:${userId}`);
    emit();
    throw new CounterDeviceMissingError();
  }
  throw error;
}

/* ------------------------- downloading and status ------------------------- */

export async function downloadBundle(userId: string) {
  const headers = await headersFor(userId);
  try {
    const { data } = await api.get("/admin/counter/bundle", { headers, timeout: 120_000 });
    const trips: CounterTrip[] = (data.trips as BundleTrip[]).map((t) => ({
      key: String(t.id),
      id: String(t.id),
      clientId: t.clientId ?? null,
      routeId: t.routeId,
      busId: t.busId,
      busNumber: t.busNumber,
      travelDate: t.travelDate,
      departureTime: t.departureTime,
      fare: Number(t.fare),
      originCity: t.originCity,
      destinationCity: t.destinationCity,
      taken: t.taken ?? [],
      unsynced: false,
    }));
    await store.replaceBundle({
      trips,
      buses: data.buses as CounterBus[],
      routes: data.routes as CounterRoute[],
      serverOffsetMs: Date.parse(data.serverTime) - Date.now(),
      extra: { refPrefix: data.refPrefix, park: data.park },
    });
    await store.pruneSales(Date.now() - KEEP_SYNCED_MS);
    emit();
  } catch (error) {
    return handleDeviceError(userId, error);
  }
}

export async function getStatus(): Promise<CounterStatus> {
  const [sales, bundleAt, trips, park] = await Promise.all([
    store.listSales(),
    store.getMeta<number>("bundleAt"),
    store.listTrips(),
    store.getMeta<{ city: string; park_name: string }>("park"),
  ]);
  return {
    pending: sales.filter((s) => s.state === "pending").length,
    needsAttention: sales.filter((s) => s.state === "flagged" || s.state === "rejected").length,
    bundleAt: bundleAt ?? null,
    trips: trips.length,
    parkName: park ? `${park.city} - ${park.park_name}` : null,
  };
}

/** Tells the server this counter is selling, so online booking pauses if it goes quiet mid-shift. */
export async function heartbeat(userId: string, selling: boolean) {
  const headers = await headersFor(userId);
  try {
    const { data } = await api.post("/admin/counter/heartbeat", { selling }, { headers, timeout: 15_000 });
    await store.setMeta("serverOffsetMs", Date.parse(data.serverTime) - Date.now());
  } catch (error) {
    return handleDeviceError(userId, error);
  }
}

/** Best-effort goodbye when the page closes while online and nothing is waiting to upload. */
export async function endShiftQuietly(userId: string) {
  const setup = await getSetup(userId);
  const token = getToken();
  if (!setup || !token || !navigator.onLine) return;
  if ((await store.listSales()).some((s) => s.state === "pending")) return;
  void fetch(`${API_URL}/api/admin/counter/heartbeat`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Device-Id": setup.deviceId },
    body: JSON.stringify({ selling: false }),
  }).catch(() => {});
}

/* ------------------------------ seat state ------------------------------ */

/** Seats on a departure with who has taken them: the server's list plus everything sold on this device. */
export async function seatMapFor(trip: CounterTrip): Promise<Seat[]> {
  const bus = await store.getBus(trip.busId);
  if (!bus) return [];
  const taken = new Set(trip.taken);
  for (const sale of await store.listSales()) {
    if (sale.tripKey === trip.key) for (const p of sale.passengers) taken.add(p.seatId);
  }
  return bus.seats.map((seat) => ({
    id: seat.id,
    seatLabel: seat.seatLabel,
    rowNum: seat.rowNum,
    colNum: seat.colNum,
    isAisle: seat.isAisle,
    isWindow: seat.isWindow,
    isBooked: !seat.isAisle && taken.has(seat.id),
    isCounterBooking: true,
  }));
}

/* ------------------------------- selling ------------------------------- */

function signTicket(secretKey: Uint8Array, keyId: string, hash: string, ref: string, tripId: string) {
  const message = new TextEncoder().encode(["v1", hash, ref, tripId].join("|"));
  const signature = nacl.sign.detached(message, secretKey);
  const query = new URLSearchParams({ r: ref, t: tripId, k: keyId, s: toBase64Url(signature) });
  return `${brand.siteUrl}/verify/${hash}?${query}`;
}

/**
 * Sells seats from this device. The sale is saved first, so it survives any failure, then sent to the
 * server straight away when there is a connection. With a connection a seat clash is refused so the
 * clerk can pick another seat; without one the ticket is issued and checked when it uploads.
 */
export async function sell(userId: string, input: SellInput): Promise<SellOutcome> {
  const setup = await getSetup(userId);
  const secret = await store.getMeta<string>(`secret:${userId}`);
  const prefix = (await store.getMeta<string>("refPrefix")) ?? brand.monogram;
  if (!setup || !secret) throw new CounterDeviceMissingError();

  const { trip, passengers } = input;
  const now = await trustedNow();
  if (!input.lateEntry && now > departureMs(trip)) {
    throw new SaleRefusedError("This bus has already departed.");
  }
  const free = new Set((await seatMapFor(trip)).filter((s) => !s.isBooked && !s.isAisle).map((s) => String(s.id)));
  for (const p of passengers) {
    if (!free.has(p.seatId)) throw new SaleRefusedError(`Seat ${p.seatLabel} is already taken.`);
  }

  const sale = await store.reserveSale((seq) => {
    const ref = referenceFor(prefix, setup.code, seq);
    const hash = randomHash();
    const qrTripId = trip.clientId ?? trip.key;
    return {
      id: uuid(),
      ref,
      hash,
      tripKey: trip.key,
      tripId: trip.id,
      tripClientId: trip.clientId,
      qrTripId,
      passengers,
      phone: input.phone,
      payment: input.payment,
      amount: trip.fare * passengers.length,
      soldAt: new Date(input.lateEntry ? Date.parse(input.lateEntry.soldAt) : now).toISOString(),
      lateEntry: Boolean(input.lateEntry),
      paperRef: input.lateEntry?.paperRef ?? null,
      qrUrl: signTicket(fromBase64(secret), setup.keyId, hash, ref, qrTripId),
      state: "pending",
      detail: null,
      created: Date.now(),
      holdUntil: navigator.onLine ? Date.now() + 45_000 : undefined,
      trip: {
        originCity: trip.originCity,
        destinationCity: trip.destinationCity,
        travelDate: trip.travelDate,
        departureTime: trip.departureTime,
        busNumber: trip.busNumber,
      },
    };
  });
  emit();

  if (!navigator.onLine) return { sale, status: "queued" };
  try {
    await syncCounter(userId, { live: sale.id });
  } catch (error) {
    await releaseHold(sale.id);
    if (error instanceof CounterDeviceRevokedError || error instanceof CounterDeviceMissingError) throw error;
    return { sale, status: "queued" };
  }

  const after = await store.getSale(sale.id);
  if (after?.state === "rejected") {
    await store.deleteSale(sale.id);
    emit();
    throw new SaleRefusedError(after.detail || "The sale could not be completed.");
  }
  if (after?.state === "pending") await releaseHold(sale.id);
  return { sale: after ?? sale, status: after?.state === "pending" ? "queued" : "synced" };
}

async function releaseHold(id: string) {
  const current = await store.getSale(id);
  if (current?.holdUntil) await store.putSale({ ...current, holdUntil: undefined });
}

/* --------------------------- extra departures --------------------------- */

export interface ExtraTripInput {
  route: CounterRoute;
  bus: CounterBus;
  travelDate: string;
  departureTime: string;
  fare: number;
  originCity: string;
}

/** Adds a departure on this device (a bus that was not scheduled). The server creates it when we next sync. */
export async function addExtraTrip(userId: string, input: ExtraTripInput) {
  const clientId = uuid();
  const trip: CounterTrip = {
    key: `L:${clientId}`,
    id: null,
    clientId,
    routeId: input.route.id,
    busId: input.bus.id,
    busNumber: input.bus.busNumber,
    travelDate: input.travelDate,
    departureTime: input.departureTime,
    fare: input.fare,
    originCity: input.originCity,
    destinationCity: input.route.destinationCity,
    taken: [],
    unsynced: true,
  };
  await store.putTrip(trip);
  emit();
  if (navigator.onLine) syncCounter(userId, {}).catch(() => {});
  return trip;
}

/* -------------------------------- syncing -------------------------------- */

let flushing: Promise<void> | null = null;

/** Sends added departures and waiting sales to the server. Safe to call at any time. */
export function syncCounter(userId: string, options: { live?: string } = {}): Promise<void> {
  if (flushing && !options.live) return flushing;
  const run = async () => {
    const headers = await headersFor(userId);
    const allSales = await store.listSales();
    const pendingSales = allSales
      .filter((s) =>
        s.state === "pending" &&
        (options.live ? s.id === options.live : !(s.holdUntil && s.holdUntil > Date.now())),
      )
      .reverse()
      .slice(0, 100);
    const trips = (await store.listTrips()).filter((t) => t.unsynced && t.clientId);
    const neededTrips = options.live
      ? trips.filter((t) => pendingSales.some((s) => s.tripClientId === t.clientId))
      : trips;
    if (pendingSales.length === 0 && neededTrips.length === 0) return;

    try {
      const { data } = await api.post(
        "/admin/counter/sync",
        {
          live: Boolean(options.live),
          trips: neededTrips.slice(0, 20).map((t) => ({
            clientId: t.clientId,
            routeId: t.routeId,
            busId: t.busId,
            travelDate: t.travelDate,
            departureTime: t.departureTime,
            fare: t.fare,
          })),
          sales: pendingSales.map((s) => ({
            id: s.id,
            ref: s.ref,
            hash: s.hash,
            tripId: s.tripId,
            tripClientId: s.tripClientId,
            qrTripId: s.qrTripId,
            passengers: s.passengers.map((p) => ({
              seatId: p.seatId,
              name: p.name,
              idCardNumber: p.idCardNumber,
              age: p.age,
              gender: p.gender,
            })),
            phone: s.phone,
            payment: s.payment,
            amount: s.amount,
            soldAt: s.soldAt,
            lateEntry: s.lateEntry,
            paperRef: s.paperRef,
          })),
        },
        { headers, timeout: 60_000 },
      );

      for (const result of data.trips as { clientId: string; id?: string; result: string; detail?: string }[]) {
        const local = neededTrips.find((t) => t.clientId === result.clientId);
        if (!local) continue;
        if (result.result === "applied" && result.id) {
          await store.putTrip({ ...local, id: result.id, unsynced: false, problem: null });
        } else {
          await store.putTrip({ ...local, problem: result.detail ?? "The server could not add this departure." });
        }
      }

      for (const result of data.sales as { id: string; result: string; detail?: string | null }[]) {
        const sale = pendingSales.find((s) => s.id === result.id);
        if (!sale) continue;
        const state = result.result === "applied" ? "synced" : result.result === "flagged" ? "flagged" : "rejected";
        await store.putSale({ ...sale, state, detail: result.detail ?? null, holdUntil: undefined });
      }
      emit();
    } catch (error) {
      return handleDeviceError(userId, error);
    }
  };

  if (options.live) return run();
  flushing = run().finally(() => {
    flushing = null;
  });
  return flushing;
}

export const listSales = store.listSales;
export const listTrips = store.listTrips;
export const listBuses = store.listBuses;
export const listRoutes = store.listRoutes;
export const getMeta = store.getMeta;
