// Local storage for the offline gate scanner. Everything here lives on the device and survives
// going offline, closing the browser and signing out, so scanned boardings are never lost.
// Personal data is encrypted with the key unlocked by the device PIN (see secure.ts).
import { blind, onUnlock, seal, unseal, wasSealed } from "./secure";
import type { Sealed } from "./secure";

export interface LocalPassenger {
  seat: string;
  name: string;
  /** ID document number, used for the printed passenger list. */
  id?: string | null;
}

export interface LocalBooking {
  id: string;
  hash: string;
  ref: string;
  trip_id: string;
  status: "confirmed" | "cancelled";
  boarded: boolean;
  boarded_at: string | null;
  passengers: LocalPassenger[];
  /** Number written on a paper ticket, when one was entered later. */
  paper_ref?: string | null;
  /** The departure id printed in the QR when it differs from trip_id (departures added offline). */
  qr_trip?: string | null;
}

export interface LocalTrip {
  id: string;
  client_id?: string | null;
  travel_date: string;
  departure_time: string;
  bus_number: string;
  origin_city: string;
  destination_city: string;
}

export interface TicketKey {
  keyId: string;
  publicKey: string;
  retired: boolean;
  /** A disabled counter device: tickets it signs are no longer trusted on their own. */
  revoked?: boolean;
}

export interface QueuedBoarding {
  id: string;
  hash: string;
  ref: string;
  scannedAt: string;
  created: number;
}

interface BookingRecord {
  hk: string;
  rk: string;
  v: Sealed | LocalBooking;
}

interface QueueRecord {
  id: string;
  created: number;
  v: Sealed | QueuedBoarding;
}

const DB_NAME = "gate-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const opening = indexedDB.open(DB_NAME, DB_VERSION);
      opening.onupgradeneeded = (event) => {
        const db = opening.result;
        if (event.oldVersion < 1) {
          db.createObjectStore("meta");
          db.createObjectStore("trips", { keyPath: "id" });
          db.createObjectStore("queue", { keyPath: "id" });
        }
        // Version 2 stores tickets under a keyed hash so the ticket codes are not readable on disk.
        // They are downloaded again; boardings waiting to sync live in the queue and are kept.
        if (db.objectStoreNames.contains("bookings")) db.deleteObjectStore("bookings");
        db.createObjectStore("bookings", { keyPath: "hk" }).createIndex("rk", "rk");
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

/* ---------------------------------- meta ---------------------------------- */

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

/** Meta values that hold personal data are encrypted. */
export async function getSecureMeta<T>(key: string): Promise<T | undefined> {
  const stored = await getMeta<Sealed | T>(key);
  return stored === undefined ? undefined : unseal<T>(stored);
}

export async function setSecureMeta(key: string, value: unknown) {
  await setMeta(key, await seal(value));
}

/* -------------------------------- bookings -------------------------------- */

const lookupKey = (hash: string) => blind(hash);
const refKey = (ref: string) => blind(ref.toUpperCase());

async function toRecord(booking: LocalBooking): Promise<BookingRecord> {
  return { hk: await lookupKey(booking.hash), rk: await refKey(booking.ref), v: await seal(booking) };
}

const fromRecord = (record: BookingRecord) => unseal<LocalBooking>(record.v);

/**
 * Replaces the downloaded reference data. A boarding still waiting to sync keeps its
 * "boarded" mark even if the server has not heard about it yet.
 */
export async function replaceBundle(bundle: {
  trips: LocalTrip[];
  bookings: LocalBooking[];
  keys: TicketKey[];
  serverOffsetMs: number;
}) {
  const pending = new Map((await listQueue()).map((q) => [q.hash, q.scannedAt]));
  const records = await Promise.all(
    bundle.bookings.map((booking) => {
      const waiting = pending.get(booking.hash);
      return toRecord(
        waiting && !booking.boarded ? { ...booking, boarded: true, boarded_at: waiting } : booking,
      );
    }),
  );

  const db = await open();
  const tx = db.transaction(["bookings", "trips", "meta"], "readwrite");
  const done = finished(tx);
  const bookings = tx.objectStore("bookings");
  const trips = tx.objectStore("trips");
  bookings.clear();
  trips.clear();
  for (const record of records) bookings.put(record);
  for (const trip of bundle.trips) trips.put(trip);
  const meta = tx.objectStore("meta");
  meta.put(bundle.keys, "keys");
  meta.put(Date.now(), "bundleAt");
  meta.put(bundle.serverOffsetMs, "serverOffsetMs");
  await done;
}

export async function clearReferenceData() {
  const db = await open();
  const tx = db.transaction(["bookings", "trips", "meta"], "readwrite");
  tx.objectStore("bookings").clear();
  tx.objectStore("trips").clear();
  tx.objectStore("meta").delete("keys");
  tx.objectStore("meta").delete("bundleAt");
  await finished(tx);
}

export async function getBookingByHash(hash: string) {
  const db = await open();
  const record = await request<BookingRecord | undefined>(
    db.transaction("bookings").objectStore("bookings").get(await lookupKey(hash)),
  );
  return record ? fromRecord(record) : undefined;
}

export async function getBookingByRef(ref: string) {
  const db = await open();
  const rows = await request<BookingRecord[]>(
    db.transaction("bookings").objectStore("bookings").index("rk").getAll(await refKey(ref)),
  );
  return rows[0] ? fromRecord(rows[0]) : undefined;
}

export async function listBookings() {
  const db = await open();
  const rows = await request<BookingRecord[]>(db.transaction("bookings").objectStore("bookings").getAll());
  return Promise.all(rows.map(fromRecord));
}

export async function searchBookings(text: string, limit = 12) {
  const needle = text.trim().toLowerCase();
  if (needle.length < 2) return [];
  return (await listBookings())
    .filter(
      (b) =>
        b.ref.toLowerCase().includes(needle) ||
        (b.paper_ref ?? "").toLowerCase().includes(needle) ||
        b.passengers.some((p) => p.name.toLowerCase().includes(needle) || p.seat.toLowerCase() === needle),
    )
    .slice(0, limit);
}

export async function countBookings() {
  const db = await open();
  return request<number>(db.transaction("bookings").objectStore("bookings").count());
}

/* ---------------------------------- trips ---------------------------------- */

export async function listTrips() {
  const db = await open();
  return request<LocalTrip[]>(db.transaction("trips").objectStore("trips").getAll());
}

/** Finds a departure by its server id or by the id a counter printed before the server knew it. */
export async function getTrip(id: string) {
  const db = await open();
  const direct = await request<LocalTrip | undefined>(db.transaction("trips").objectStore("trips").get(id));
  if (direct) return direct;
  return (await listTrips()).find((trip) => trip.client_id === id);
}

/* ---------------------------- boardings to upload ---------------------------- */

async function putBooking(booking: LocalBooking) {
  const db = await open();
  const record = await toRecord(booking);
  const tx = db.transaction("bookings", "readwrite");
  tx.objectStore("bookings").put(record);
  await finished(tx);
}

/** Saves a boarding and marks the ticket as used on this device. */
export async function saveBoarding(entry: QueuedBoarding, listed: boolean) {
  const db = await open();
  const record: QueueRecord = { id: entry.id, created: entry.created, v: await seal(entry) };
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").put(record);
  await finished(tx);
  if (listed) {
    const current = await getBookingByHash(entry.hash);
    if (current) await putBooking({ ...current, boarded: true, boarded_at: entry.scannedAt });
  }
}

const fromQueue = (record: QueueRecord | QueuedBoarding) =>
  "v" in record ? unseal<QueuedBoarding>(record.v) : Promise.resolve(record);

export async function listQueue() {
  const db = await open();
  const rows = await request<(QueueRecord | QueuedBoarding)[]>(db.transaction("queue").objectStore("queue").getAll());
  return (await Promise.all(rows.map(fromQueue))).sort((a, b) => a.created - b.created);
}

export async function countQueue() {
  const db = await open();
  return request<number>(db.transaction("queue").objectStore("queue").count());
}

export async function removeFromQueue(ids: string[]) {
  if (ids.length === 0) return;
  const db = await open();
  const tx = db.transaction("queue", "readwrite");
  for (const id of ids) tx.objectStore("queue").delete(id);
  await finished(tx);
}

export async function markBoarded(hash: string, boardedAt: string) {
  const current = await getBookingByHash(hash);
  if (current) await putBooking({ ...current, boarded: true, boarded_at: boardedAt });
}

/* ------------------------- encrypting older plain data ------------------------- */

// Runs when the device is unlocked. Data written before a PIN existed is encrypted in place;
// ticket lists stored without keys cannot be looked up any more, so they are downloaded again.
onUnlock(async () => {
  const db = await open();

  const queue = await request<(QueueRecord | QueuedBoarding)[]>(db.transaction("queue").objectStore("queue").getAll());
  const plain = queue.filter((r) => !("v" in r));
  if (plain.length) {
    const sealed = await Promise.all(
      (plain as QueuedBoarding[]).map(async (entry) => ({ id: entry.id, created: entry.created, v: await seal(entry) })),
    );
    const tx = db.transaction("queue", "readwrite");
    for (const record of sealed) tx.objectStore("queue").put(record);
    await finished(tx);
  }

  const first = await request<BookingRecord[]>(db.transaction("bookings").objectStore("bookings").getAll(undefined, 1));
  if (first[0] && !wasSealed(first[0].v)) await clearReferenceData();

  const issues = await getMeta<unknown>("issues");
  if (issues !== undefined && !wasSealed(issues)) await setSecureMeta("issues", issues);
});
