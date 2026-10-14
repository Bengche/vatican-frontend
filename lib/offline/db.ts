// Local storage for the offline gate scanner. Everything here lives on the device and survives
// going offline, closing the browser and signing out, so scanned boardings are never lost.

export interface LocalPassenger {
  seat: string;
  name: string;
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

const DB_NAME = "gate-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const opening = indexedDB.open(DB_NAME, DB_VERSION);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        db.createObjectStore("meta");
        db.createObjectStore("bookings", { keyPath: "hash" }).createIndex(
          "ref",
          "ref",
        );
        db.createObjectStore("trips", { keyPath: "id" });
        db.createObjectStore("queue", { keyPath: "id" });
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
  return request<T | undefined>(
    db.transaction("meta").objectStore("meta").get(key),
  );
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
 * Replaces the downloaded reference data. A boarding still waiting to sync keeps its
 * "boarded" mark even if the server has not heard about it yet.
 */
export async function replaceBundle(bundle: {
  trips: LocalTrip[];
  bookings: LocalBooking[];
  keys: TicketKey[];
  serverOffsetMs: number;
}) {
  const db = await open();
  const tx = db.transaction(["bookings", "trips", "queue", "meta"], "readwrite");
  const done = finished(tx);

  const queued = tx.objectStore("queue").getAll();
  queued.onsuccess = () => {
    const pending = new Map(
      (queued.result as QueuedBoarding[]).map((q) => [q.hash, q.scannedAt]),
    );
    const bookings = tx.objectStore("bookings");
    const trips = tx.objectStore("trips");
    bookings.clear();
    trips.clear();
    for (const booking of bundle.bookings) {
      const waiting = pending.get(booking.hash);
      bookings.put(
        waiting && !booking.boarded
          ? { ...booking, boarded: true, boarded_at: waiting }
          : booking,
      );
    }
    for (const trip of bundle.trips) trips.put(trip);

    const meta = tx.objectStore("meta");
    meta.put(bundle.keys, "keys");
    meta.put(Date.now(), "bundleAt");
    meta.put(bundle.serverOffsetMs, "serverOffsetMs");
  };
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
  return request<LocalBooking | undefined>(
    db.transaction("bookings").objectStore("bookings").get(hash),
  );
}

export async function getBookingByRef(ref: string) {
  const db = await open();
  const rows = await request<LocalBooking[]>(
    db
      .transaction("bookings")
      .objectStore("bookings")
      .index("ref")
      .getAll(ref.toUpperCase()),
  );
  return rows[0];
}

export async function searchBookings(text: string, limit = 12) {
  const needle = text.trim().toLowerCase();
  if (needle.length < 2) return [];
  const db = await open();
  const all = await request<LocalBooking[]>(
    db.transaction("bookings").objectStore("bookings").getAll(),
  );
  return all
    .filter(
      (b) =>
        b.ref.toLowerCase().includes(needle) ||
        (b.paper_ref ?? "").toLowerCase().includes(needle) ||
        b.passengers.some(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.seat.toLowerCase() === needle,
        ),
    )
    .slice(0, limit);
}

export async function countBookings() {
  const db = await open();
  return request<number>(
    db.transaction("bookings").objectStore("bookings").count(),
  );
}

export async function listTrips() {
  const db = await open();
  return request<LocalTrip[]>(
    db.transaction("trips").objectStore("trips").getAll(),
  );
}

/** Finds a departure by its server id or by the id a counter printed before the server knew it. */
export async function getTrip(id: string) {
  const db = await open();
  const direct = await request<LocalTrip | undefined>(
    db.transaction("trips").objectStore("trips").get(id),
  );
  if (direct) return direct;
  const all = await request<LocalTrip[]>(
    db.transaction("trips").objectStore("trips").getAll(),
  );
  return all.find((trip) => trip.client_id === id);
}

/** Saves a boarding and marks the ticket as used on this device in one step. */
export async function saveBoarding(entry: QueuedBoarding, listed: boolean) {
  const db = await open();
  const tx = db.transaction(["bookings", "queue"], "readwrite");
  const done = finished(tx);
  tx.objectStore("queue").put(entry);
  if (listed) {
    const bookings = tx.objectStore("bookings");
    const read = bookings.get(entry.hash);
    read.onsuccess = () => {
      const current = read.result as LocalBooking | undefined;
      if (current)
        bookings.put({ ...current, boarded: true, boarded_at: entry.scannedAt });
    };
  }
  await done;
}

export async function listQueue() {
  const db = await open();
  const rows = await request<QueuedBoarding[]>(
    db.transaction("queue").objectStore("queue").getAll(),
  );
  return rows.sort((a, b) => a.created - b.created);
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
  const db = await open();
  const tx = db.transaction("bookings", "readwrite");
  const store = tx.objectStore("bookings");
  const read = store.get(hash);
  read.onsuccess = () => {
    const current = read.result as LocalBooking | undefined;
    if (current) store.put({ ...current, boarded: true, boarded_at: boardedAt });
  };
  await finished(tx);
}
