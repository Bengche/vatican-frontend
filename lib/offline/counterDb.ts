// Local storage for the offline counter (sales till). Kept separate from the gate scanner's database.
// Everything survives going offline, closing the browser and signing out, so a sale is never lost.
// Sales and the device's signing key are encrypted with the key unlocked by the device PIN (see secure.ts).
import { onUnlock, seal, unseal, wasSealed } from "./secure";
import type { Sealed } from "./secure";

export interface CounterSeat {
  id: string;
  seatLabel: string;
  rowNum: number;
  colNum: number;
  isAisle: boolean;
  isWindow?: boolean;
}

export interface CounterBus {
  id: string;
  busNumber: string;
  busType: string;
  totalSeats: number;
  seats: CounterSeat[];
}

export interface CounterRoute {
  id: string;
  destinationCity: string;
  destinationPark: string;
  fare: number;
}

export interface CounterTrip {
  /** Stable local key: the server id for published departures, "L:<uuid>" for ones added offline. */
  key: string;
  id: string | null;
  clientId: string | null;
  routeId: string;
  busId: string;
  busNumber: string;
  travelDate: string;
  departureTime: string;
  fare: number;
  originCity: string;
  destinationCity: string;
  taken: string[];
  /** Added on this device and not yet known to the server. */
  unsynced: boolean;
  problem?: string | null;
}

export interface SalePassenger {
  seatId: string;
  seatLabel: string;
  name: string;
  idCardNumber: string;
  age: number;
  gender: "male" | "female" | "other";
}

export type SaleState = "pending" | "synced" | "flagged" | "rejected";

export interface CounterSale {
  id: string;
  ref: string;
  hash: string;
  tripKey: string;
  tripId: string | null;
  tripClientId: string | null;
  qrTripId: string;
  passengers: SalePassenger[];
  phone: string;
  payment: { method: "cash" | "momo"; ref?: string };
  amount: number;
  soldAt: string;
  lateEntry: boolean;
  paperRef: string | null;
  qrUrl: string;
  state: SaleState;
  detail: string | null;
  created: number;
  /** While set and in the future, background sync leaves this sale alone: a live attempt is in progress. */
  holdUntil?: number;
  /** Copied from the departure so the ticket can be reprinted without it. */
  trip: {
    originCity: string;
    destinationCity: string;
    travelDate: string;
    departureTime: string;
    busNumber: string;
  };
}

const DB_NAME = "counter-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const opening = indexedDB.open(DB_NAME, DB_VERSION);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        db.createObjectStore("meta");
        db.createObjectStore("trips", { keyPath: "key" });
        db.createObjectStore("buses", { keyPath: "id" });
        db.createObjectStore("routes", { keyPath: "id" });
        db.createObjectStore("sales", { keyPath: "id" });
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => {
        dbPromise = null;
        reject(opening.error);
      };
    });
  }
  return dbPromise;
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return request<T | undefined>(db.transaction("meta").objectStore("meta").get(key));
}

export async function setMeta(key: string, value: unknown) {
  const db = await open();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(value, key);
  await finished(tx);
}

export async function deleteMeta(key: string) {
  const db = await open();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").delete(key);
  await finished(tx);
}

/**
 * Replaces the downloaded departures, bus layouts and routes. Departures added on this device and not
 * yet confirmed by the server are kept; a local one the server now knows about is replaced by the real one.
 */
export async function replaceBundle(bundle: {
  trips: CounterTrip[];
  buses: CounterBus[];
  routes: CounterRoute[];
  serverOffsetMs: number;
  extra: Record<string, unknown>;
}) {
  const db = await open();
  const tx = db.transaction(["trips", "buses", "routes", "meta"], "readwrite");
  const done = finished(tx);

  const existing = tx.objectStore("trips").getAll();
  existing.onsuccess = () => {
    const trips = tx.objectStore("trips");
    const known = new Set(bundle.trips.map((t) => t.clientId).filter(Boolean));
    const keep = (existing.result as CounterTrip[]).filter(
      (t) => t.unsynced && !(t.clientId && known.has(t.clientId)),
    );
    trips.clear();
    for (const trip of bundle.trips) trips.put(trip);
    for (const trip of keep) trips.put(trip);

    const buses = tx.objectStore("buses");
    buses.clear();
    for (const bus of bundle.buses) buses.put(bus);
    const routes = tx.objectStore("routes");
    routes.clear();
    for (const route of bundle.routes) routes.put(route);

    const meta = tx.objectStore("meta");
    meta.put(Date.now(), "bundleAt");
    meta.put(bundle.serverOffsetMs, "serverOffsetMs");
    for (const [key, value] of Object.entries(bundle.extra)) meta.put(value, key);
  };
  await done;
}

export async function listTrips() {
  const db = await open();
  return request<CounterTrip[]>(db.transaction("trips").objectStore("trips").getAll());
}

export async function getTrip(key: string) {
  const db = await open();
  return request<CounterTrip | undefined>(db.transaction("trips").objectStore("trips").get(key));
}

export async function putTrip(trip: CounterTrip) {
  const db = await open();
  const tx = db.transaction("trips", "readwrite");
  tx.objectStore("trips").put(trip);
  await finished(tx);
}

export async function listBuses() {
  const db = await open();
  return request<CounterBus[]>(db.transaction("buses").objectStore("buses").getAll());
}

export async function getBus(id: string) {
  const db = await open();
  return request<CounterBus | undefined>(db.transaction("buses").objectStore("buses").get(id));
}

export async function listRoutes() {
  const db = await open();
  return request<CounterRoute[]>(db.transaction("routes").objectStore("routes").getAll());
}

interface SaleRecord {
  id: string;
  created: number;
  v: Sealed | CounterSale;
}

const toSaleRecord = async (sale: CounterSale): Promise<SaleRecord> => ({
  id: sale.id,
  created: sale.created,
  v: await seal(sale),
});

// Sales saved before encryption existed are plain objects; both shapes are read the same way.
const fromSaleRecord = (record: SaleRecord | CounterSale) =>
  "v" in record ? unseal<CounterSale>(record.v) : Promise.resolve(record);

export async function listSales() {
  const db = await open();
  const rows = await request<(SaleRecord | CounterSale)[]>(db.transaction("sales").objectStore("sales").getAll());
  return (await Promise.all(rows.map(fromSaleRecord))).sort((a, b) => b.created - a.created);
}

export async function getSale(id: string) {
  const db = await open();
  const row = await request<SaleRecord | CounterSale | undefined>(db.transaction("sales").objectStore("sales").get(id));
  return row ? fromSaleRecord(row) : undefined;
}

export async function putSale(sale: CounterSale) {
  const db = await open();
  const record = await toSaleRecord(sale);
  const tx = db.transaction("sales", "readwrite");
  tx.objectStore("sales").put(record);
  await finished(tx);
}

export async function deleteSale(id: string) {
  const db = await open();
  const tx = db.transaction("sales", "readwrite");
  tx.objectStore("sales").delete(id);
  await finished(tx);
}

/** Meta values that hold secrets or personal data are encrypted. */
export async function getSecureMeta<T>(key: string): Promise<T | undefined> {
  const stored = await getMeta<Sealed | T>(key);
  return stored === undefined ? undefined : unseal<T>(stored);
}

export async function setSecureMeta(key: string, value: unknown) {
  await setMeta(key, await seal(value));
}

/**
 * Takes the next ticket number and stores the finished sale. The number is taken first, in a
 * transaction of its own, so two quick sales can never get the same reference; if the page dies before
 * the sale is saved a number is skipped, which is harmless.
 */
export async function reserveSale(build: (seq: number) => CounterSale) {
  const db = await open();
  const tx = db.transaction("meta", "readwrite");
  const done = finished(tx);
  const meta = tx.objectStore("meta");
  const seqRead = meta.get("refSeq");
  const taken = new Promise<number>((resolve) => {
    seqRead.onsuccess = () => {
      const seq = (seqRead.result as number | undefined) ?? 0;
      meta.put(seq + 1, "refSeq");
      resolve(seq);
    };
  });
  const seq = await taken;
  await done;

  const sale = build(seq);
  await putSale(sale);
  return sale;
}

/** Removes sales that reached the server and are old enough to no longer be needed for a reprint. */
export async function pruneSales(olderThanMs: number) {
  const old = (await listSales()).filter((s) => s.state === "synced" && s.created < olderThanMs);
  if (old.length === 0) return;
  const db = await open();
  const tx = db.transaction("sales", "readwrite");
  for (const sale of old) tx.objectStore("sales").delete(sale.id);
  await finished(tx);
}

export async function clearReferenceData() {
  const db = await open();
  const tx = db.transaction(["trips", "buses", "routes", "meta"], "readwrite");
  tx.objectStore("trips").clear();
  tx.objectStore("buses").clear();
  tx.objectStore("routes").clear();
  tx.objectStore("meta").delete("bundleAt");
  await finished(tx);
}

// Runs when the device is unlocked: anything saved before a PIN existed is encrypted in place.
onUnlock(async () => {
  const db = await open();

  const rows = await request<(SaleRecord | CounterSale)[]>(db.transaction("sales").objectStore("sales").getAll());
  const plain = rows.filter((r) => !("v" in r)) as CounterSale[];
  if (plain.length) {
    const sealed = await Promise.all(plain.map(toSaleRecord));
    const tx = db.transaction("sales", "readwrite");
    for (const record of sealed) tx.objectStore("sales").put(record);
    await finished(tx);
  }

  const keys = (await request<IDBValidKey[]>(db.transaction("meta").objectStore("meta").getAllKeys())).map(String);
  for (const key of keys.filter((k) => k.startsWith("secret:"))) {
    const value = await getMeta<unknown>(key);
    if (value !== undefined && !wasSealed(value)) await setSecureMeta(key, value);
  }
});
