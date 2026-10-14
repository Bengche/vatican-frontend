"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import PageHeader from "../../components/PageHeader";
import SeatMap from "../../components/SeatMap";
import PassengerFields from "../../components/PassengerFields";
import TicketSlip from "../../components/TicketSlip";
import ClockWarning from "../../components/ClockWarning";
import DaySummarySheet from "../../components/DaySummarySheet";
import { api, errorMessage, isNetworkError } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, formatXAF } from "@/lib/format";
import * as counter from "@/lib/offline/counter";
import type { CounterStatus } from "@/lib/offline/counter";
import { downloadCsv } from "@/lib/offline/backup";
import { summarize, summaryText } from "@/lib/offline/summary";
import { LockedError } from "@/lib/offline/secure";
import type { CounterBus, CounterRoute, CounterSale, CounterTrip } from "@/lib/offline/counterDb";
import { checkPin, hasPin, pinSupported, savePin } from "@/lib/offline/pin";
import type { PassengerInput, Park, Seat } from "@/lib/types";

type Phase = "loading" | "unsupported" | "setup" | "pin-setup" | "locked" | "ready" | "revoked";
type Notice = { type: "success" | "error"; text: string } | null;

const REFRESH_MS = 90_000;
const STALE_MS = 24 * 3_600_000;
const IDLE_LOCK_MS = 5 * 60_000;
const MAX_PIN_TRIES = 5;

const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

const STATE_BADGE: Record<CounterSale["state"], { text: string; tone: string }> = {
  pending: { text: "Waiting to upload", tone: "bg-amber-50 text-amber-800" },
  synced: { text: "Recorded", tone: "bg-emerald-50 text-emerald-700" },
  flagged: { text: "Needs a manager", tone: "bg-red-50 text-red-700" },
  rejected: { text: "Not accepted", tone: "bg-red-50 text-red-700" },
};

const emptyPassenger = (seat: Seat): PassengerInput => ({
  seatId: seat.id,
  name: "",
  idCardNumber: "",
  age: "",
  gender: "male",
});

function ago(ms: number | null, now: number) {
  if (!ms) return "never";
  const minutes = Math.floor((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

export default function CounterSalesPage() {
  const user = useUser();
  const userId = user ? String(user.id) : null;
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [restart, setRestart] = useState(0);
  const [now, setNow] = useState(0);
  const [reachable, setReachable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<CounterStatus>({ pending: 0, needsAttention: 0, bundleAt: null, trips: 0, parkName: null, clockOffsetMs: 0 });
  const [notice, setNotice] = useState<Notice>(null);

  const [label, setLabel] = useState("");
  const [parkId, setParkId] = useState("");
  const [parks, setParks] = useState<Park[]>([]);
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [pinError, setPinError] = useState("");
  const [tries, setTries] = useState(0);
  const [formBusy, setFormBusy] = useState(false);

  const [trips, setTrips] = useState<CounterTrip[]>([]);
  const [buses, setBuses] = useState<CounterBus[]>([]);
  const [routes, setRoutes] = useState<CounterRoute[]>([]);
  const [sales, setSales] = useState<CounterSale[]>([]);
  const [tripKey, setTripKey] = useState("");
  const [version, setVersion] = useState(0);
  const [mapKey, setMapKey] = useState(0);

  const [seats, setSeats] = useState<Seat[]>([]);
  const [passengers, setPassengers] = useState<PassengerInput[]>([]);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"cash" | "momo">("cash");
  const [momoRef, setMomoRef] = useState("");
  const [late, setLate] = useState(false);
  const [paperRef, setPaperRef] = useState("");
  const [soldAt, setSoldAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ sale: CounterSale; status: "synced" | "queued" } | null>(null);
  const [slip, setSlip] = useState<CounterSale | null>(null);
  const [printKind, setPrintKind] = useState<"ticket" | "summary">("ticket");

  const [extraOpen, setExtraOpen] = useState(false);
  const [extra, setExtra] = useState({ routeId: "", busId: "", date: "", time: "", fare: "" });

  const lastActive = useRef(0);

  const refreshLocal = useCallback(async () => {
    try {
      const [t, b, r, s, st] = await Promise.all([
        counter.listTrips(),
        counter.listBuses(),
        counter.listRoutes(),
        counter.listSales(),
        counter.getStatus(),
      ]);
      t.sort((x, y) => `${x.travelDate}${x.departureTime}`.localeCompare(`${y.travelDate}${y.departureTime}`));
      setTrips(t);
      setBuses(b);
      setRoutes(r);
      setSales(s);
      setStatus(st);
      setVersion((n) => n + 1);
      setTripKey((current) => {
        if (current && t.some((x) => x.key === current)) return current;
        const wanted = new URLSearchParams(window.location.search).get("tripId");
        return t.find((x) => x.id === wanted)?.key ?? t[0]?.key ?? "";
      });
    } catch (err) {
      // While the phone is locked its data cannot be read; the screen simply waits for the PIN.
      if (!(err instanceof LockedError)) setNotice({ type: "error", text: "We could not read the saved counter data on this device." });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      if (typeof indexedDB === "undefined") return "unsupported";
      if (await counter.isRevoked(userId)) return "revoked";
      if (!(await counter.getSetup(userId))) return "setup";
      if (pinSupported()) return (await hasPin()) ? "locked" : "pin-setup";
      return "ready";
    })()
      .then((next) => active && setPhase(next as Phase))
      .catch(() => active && setPhase("unsupported"));
    return () => {
      active = false;
    };
  }, [userId, restart]);

  useEffect(() => {
    if (phase !== "setup") return;
    let active = true;
    api
      .get("/parks")
      .then(({ data }) => active && setParks(data.parks ?? []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready") return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(() => {
      tick();
      void refreshLocal();
    }, 0);
    const clock = window.setInterval(tick, 30_000);
    const off = counter.onCounterChange(() => void refreshLocal());
    return () => {
      window.clearTimeout(first);
      window.clearInterval(clock);
      off();
    };
  }, [phase, refreshLocal]);

  const sync = useCallback(
    async (force: boolean) => {
      if (!userId || !navigator.onLine) return;
      setSyncing(true);
      try {
        await counter.heartbeat(userId, true);
        await counter.syncCounter(userId);
        const bundleAt = await counter.getMeta<number>("bundleAt");
        if (force || !bundleAt || Date.now() - bundleAt > REFRESH_MS) await counter.downloadBundle(userId);
        if (force) setNotice({ type: "success", text: "Up to date." });
        setReachable(true);
      } catch (err) {
        if (err instanceof counter.CounterDeviceRevokedError) setPhase("revoked");
        else if (err instanceof counter.CounterDeviceMissingError) setPhase("setup");
        else {
          // A phone can report "connected" while the network carries no data.
          if (isNetworkError(err)) setReachable(false);
          if (force) setNotice({ type: "error", text: errorMessage(err, "We could not sync right now. Your sales are safe on this device.") });
        }
      } finally {
        setSyncing(false);
      }
    },
    [userId],
  );

  // Stay in step with the server whenever a connection is available.
  useEffect(() => {
    if (phase !== "ready" || !userId) return;
    const run = () => void sync(false);
    const first = window.setTimeout(run, 0);
    const interval = window.setInterval(run, 30_000);
    window.addEventListener("online", run);
    const bye = () => counter.endShiftNow();
    window.addEventListener("pagehide", bye);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("online", run);
      window.removeEventListener("pagehide", bye);
      bye();
    };
  }, [phase, userId, sync]);

  // Save this screen for offline use so the counter still opens with no connection.
  useEffect(() => {
    if (phase !== "ready" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage({ type: "PRECACHE", urls: [window.location.pathname] }))
      .catch(() => {});
  }, [phase]);

  // Lock again after a few idle minutes so a phone left on the counter is not usable.
  useEffect(() => {
    if (phase !== "ready" || !pinSupported()) return;
    const touch = () => {
      lastActive.current = Date.now();
    };
    touch();
    const interval = window.setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_LOCK_MS) {
        setPin("");
        setPhase("locked");
      }
    }, 15_000);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [phase]);

  const trip = trips.find((t) => t.key === tripKey) ?? null;
  const total = (trip?.fare ?? 0) * seats.length;
  const connected = online && reachable;
  const empty = status.bundleAt === null;
  const stale = status.bundleAt !== null && now - status.bundleAt > STALE_MS;

  const loader = useCallback(() => (trip ? counter.seatMapFor(trip) : Promise.resolve([] as Seat[])), [trip]);

  const chooseSeats = (chosen: Seat[]) => {
    setSeats(chosen);
    setPassengers(chosen.map(emptyPassenger));
    setError("");
  };

  const resetSale = () => {
    setSeats([]);
    setPassengers([]);
    setPhone("");
    setMomoRef("");
    setMethod("cash");
    setPaperRef("");
    setMapKey((k) => k + 1);
  };

  const issue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip || !userId) return;
    for (const [index, p] of passengers.entries()) {
      const who = passengers.length > 1 ? ` for passenger ${index + 1}` : "";
      if (p.name.trim().length < 3) return setError(`Enter the passenger's full name${who}.`);
      if (p.idCardNumber.trim().length < 5) return setError(`Enter a valid ID document number${who}.`);
      const age = Number.parseInt(p.age, 10);
      if (!Number.isInteger(age) || age < 1 || age > 119) return setError(`Enter a valid age${who}.`);
    }
    if (method === "momo" && !/^[A-Za-z0-9._-]{6,40}$/.test(momoRef.trim())) {
      return setError("Enter the Mobile Money transaction number from the confirmation SMS.");
    }
    let lateEntry: { paperRef: string; soldAt: string } | null = null;
    if (late) {
      const when = Date.parse(soldAt);
      if (!paperRef.trim()) return setError("Enter the number written on the paper ticket.");
      if (!Number.isFinite(when) || when > Date.now() + 5 * 60_000) return setError("Enter when the paper ticket was sold.");
      lateEntry = { paperRef: paperRef.trim(), soldAt: new Date(when).toISOString() };
    }

    setSubmitting(true);
    setError("");
    try {
      const outcome = await counter.sell(userId, {
        trip,
        passengers: passengers.map((p, i) => ({
          seatId: String(p.seatId),
          seatLabel: seats[i].seatLabel,
          name: p.name.trim().replace(/\s+/g, " "),
          idCardNumber: p.idCardNumber.trim().toUpperCase(),
          age: Number.parseInt(p.age, 10),
          gender: p.gender,
        })),
        phone: phone.trim(),
        payment: method === "momo" ? { method, ref: momoRef.trim() } : { method },
        lateEntry,
      });
      setIssued(outcome);
      resetSale();
    } catch (err) {
      if (err instanceof counter.SaleRefusedError) {
        setError(err.message);
        setSeats([]);
        setPassengers([]);
        setMapKey((k) => k + 1);
        if (navigator.onLine) void counter.downloadBundle(userId).catch(() => {});
      } else if (err instanceof counter.CounterDeviceRevokedError) setPhase("revoked");
      else if (err instanceof counter.CounterDeviceMissingError) setPhase("setup");
      else setError(errorMessage(err, "We could not issue this ticket."));
    } finally {
      setSubmitting(false);
    }
  };

  const print = (sale: CounterSale) => {
    setSlip(sale);
    setPrintKind("ticket");
    window.setTimeout(() => {
      document.body.classList.add("printing-ticket");
      window.addEventListener("afterprint", () => document.body.classList.remove("printing-ticket"), { once: true });
      window.print();
    }, 50);
  };

  const day = now ? counter.dayOf(now) : "";
  const summary = summarize(sales, day, counter.dayOf);
  const agentName = user?.name || "Counter agent";

  const printSummary = () => {
    setPrintKind("summary");
    window.setTimeout(() => {
      document.body.classList.add("printing-ticket");
      window.addEventListener("afterprint", () => document.body.classList.remove("printing-ticket"), { once: true });
      window.print();
    }, 50);
  };

  const shareSummary = async () => {
    const text = summaryText(summary, agentName, status.parkName);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice({ type: "success", text: "Summary copied. Paste it into a message." });
      }
    } catch {
      /* sharing was cancelled */
    }
  };

  // A plain-text copy of what is on the phone, so a manager can enter the sales by hand if the phone is lost.
  const saveBackup = () => {
    downloadCsv(`counter-sales-${day || "today"}.csv`, [
      ["Ticket", "Paper number", "Sold at", "Passengers", "Seats", "Amount XAF", "Paid by", "Mobile Money number", "Status"],
      ...sales.map((s) => [
        s.ref,
        s.paperRef ?? "",
        s.soldAt,
        s.passengers.map((p) => p.name).join("; "),
        s.passengers.map((p) => p.seatLabel).join("; "),
        s.amount,
        s.payment.method,
        s.payment.ref ?? "",
        s.state,
      ]),
    ]);
    setNotice({ type: "success", text: "Backup saved. It contains passenger names, so keep the file private." });
  };

  const addExtra = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    const route = routes.find((r) => r.id === extra.routeId);
    const bus = buses.find((b) => b.id === extra.busId);
    const fare = Number.parseInt(extra.fare, 10);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Douala" });
    if (!route || !bus) return setError("Choose the destination and the bus.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extra.date) || extra.date < today) return setError("Choose today or a later date.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(extra.time)) return setError("Enter the departure time.");
    if (!Number.isInteger(fare) || fare < 500 || fare > 500000) return setError("Enter the fare in XAF.");
    setError("");
    const added = await counter.addExtraTrip(userId, {
      route,
      bus,
      travelDate: extra.date,
      departureTime: extra.time,
      fare,
      originCity: trips[0]?.originCity ?? status.parkName?.split(" - ")[0] ?? "",
    });
    setTripKey(added.key);
    setExtraOpen(false);
    setNotice({ type: "success", text: "Extra bus added. You can sell tickets on it now; it uploads when there is a connection." });
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setFormBusy(true);
    setNotice(null);
    try {
      await counter.registerCounter(userId, label.trim(), parkId);
      setRestart((n) => n + 1);
    } catch (err) {
      setNotice({ type: "error", text: online ? errorMessage(err, "We could not set up this device.") : "Connect to the internet once to set up this device." });
    } finally {
      setFormBusy(false);
    }
  };

  const createPin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPinError("");
    if (!/^\d{6}$/.test(pin)) return setPinError("Use exactly 6 digits.");
    if (pin !== pinAgain) return setPinError("The two PINs do not match.");
    setFormBusy(true);
    try {
      await savePin(pin);
      setPin("");
      setPinAgain("");
      lastActive.current = Date.now();
      setPhase("ready");
    } catch {
      setPinError("We could not save the PIN on this device.");
    } finally {
      setFormBusy(false);
    }
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setPinError("");
    setFormBusy(true);
    try {
      if (await checkPin(pin)) {
        setTries(0);
        setPin("");
        lastActive.current = Date.now();
        setPhase("ready");
      } else {
        const used = tries + 1;
        setTries(used);
        setPin("");
        setPinError(used >= MAX_PIN_TRIES ? "Too many wrong attempts. Sign out and sign in again to reset this device." : "Wrong PIN.");
      }
    } finally {
      setFormBusy(false);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Counter sales"
      title="Issue a ticket"
      description="Sell seats at the counter. This works with no internet: tickets are made on this device and uploaded when a connection returns."
    />
  );

  if (phase === "loading" || !userId) return <div className="mx-auto max-w-6xl">{header}</div>;

  if (phase === "unsupported") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <div className="alert alert-error">This browser cannot store data for offline selling. Use a recent version of Chrome, Edge, Firefox or Safari.</div>
      </div>
    );
  }

  if (phase === "revoked") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <div className="alert alert-error" role="alert">
          This device has been disabled by an administrator and its downloaded data was removed.
          {status.pending > 0 && ` ${status.pending} sale(s) saved here were not uploaded.`} Contact your administrator.
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <form onSubmit={register} className="card max-w-md space-y-3 p-5">
          <h2 className="text-base font-bold text-slate-900">Set up this device as a ticket counter</h2>
          <p className="text-sm text-slate-600">Do this once while you have internet. Afterwards this phone can sell tickets with no connection for days.</p>
          {notice && <div className={`alert ${notice.type === "error" ? "alert-error" : "alert-success"}`}>{notice.text}</div>}
          <label htmlFor="counter-label" className="label">Device name</label>
          <input id="counter-label" className="input" placeholder="Counter phone" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          <label htmlFor="counter-park" className="label">Terminal you sell from</label>
          <select id="counter-park" className="input" value={parkId} onChange={(e) => setParkId(e.target.value)}>
            <option value="">Choose a terminal</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.city} - {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={formBusy || !label.trim() || !parkId || !online}>
            {formBusy ? "Setting up..." : "Set up device"}
          </button>
          {!online && <p className="text-xs text-amber-700">You are offline. Connect to the internet to continue.</p>}
        </form>
      </div>
    );
  }

  if (phase === "pin-setup") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <form onSubmit={createPin} className="card max-w-md space-y-3 p-5">
          <h2 className="text-base font-bold text-slate-900">Choose a PIN for this device</h2>
          <p className="text-sm text-slate-600">The counter locks after a few idle minutes and asks for this PIN. The PIN also protects the sales and passenger data stored on this phone, so choose 6 digits that are hard to guess and do not share them.</p>
          {pinError && <div className="alert alert-error" role="alert">{pinError}</div>}
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="6 digits" maxLength={6} aria-label="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Repeat PIN" maxLength={6} aria-label="Repeat PIN" value={pinAgain} onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ""))} />
          <button type="submit" className="btn btn-primary" disabled={formBusy}>Save PIN</button>
        </form>
      </div>
    );
  }

  if (phase === "locked") {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <form onSubmit={unlock} className="card max-w-xs space-y-3 p-5">
          <h2 className="text-base font-bold text-slate-900">Counter locked</h2>
          {status.pending > 0 && <p className="text-xs text-slate-500">{status.pending} sale(s) waiting to upload.</p>}
          {pinError && <div className="alert alert-error" role="alert">{pinError}</div>}
          <input className="input" type="password" inputMode="numeric" autoComplete="off" placeholder="PIN" maxLength={8} aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} disabled={tries >= MAX_PIN_TRIES} />
          <button type="submit" className="btn btn-primary" disabled={formBusy || pin.length < 4 || tries >= MAX_PIN_TRIES}>Unlock</button>
        </form>
      </div>
    );
  }

  const tripLabel = (t: CounterTrip) =>
    `${t.originCity} to ${t.destinationCity} | ${formatDate(t.travelDate)} ${formatTime(t.departureTime)} | ${t.busNumber}${t.unsynced ? " (added here)" : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      {header}

      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {connected ? "Online" : "No connection: selling from this device"}
          </span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${status.pending ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
            {status.pending ? `${status.pending} sale(s) waiting to upload` : "Everything uploaded"}
          </span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${empty || stale ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
            {empty ? "No departures saved yet" : `Seats updated ${ago(status.bundleAt, now)}`}
          </span>
          <button type="button" className="btn btn-outline btn-sm ml-auto" disabled={!online || syncing} onClick={() => void sync(true)}>
            {syncing ? "Syncing..." : "Sync and update seats"}
          </button>
        </div>

        <ClockWarning offsetMs={status.clockOffsetMs} />
        {(empty || stale) && (
          <div className="alert alert-error mb-4" role="alert">
            {empty
              ? "Connect to the internet and press Sync and update seats before you lose your connection."
              : "The saved seats are more than a day old. Seats sold elsewhere since then are not shown."}
          </div>
        )}
        {status.needsAttention > 0 && (
          <div className="alert alert-error mb-4" role="alert">
            {status.needsAttention} sale(s) need a manager&apos;s attention, shown below. Do not resell those seats.
          </div>
        )}
        {notice && <div className={`alert mb-4 ${notice.type === "error" ? "alert-error" : "alert-success"}`} role="status">{notice.text}</div>}

        <div className="card mb-6 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="trip" className="label">Departure</label>
              <select
                id="trip"
                className="input"
                value={tripKey}
                disabled={trips.length === 0}
                onChange={(e) => {
                  setTripKey(e.target.value);
                  setSeats([]);
                  setPassengers([]);
                  setIssued(null);
                  setError("");
                  setMapKey((k) => k + 1);
                }}
              >
                {trips.length === 0 ? <option>No saved departures</option> : trips.map((t) => <option key={t.key} value={t.key}>{tripLabel(t)}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-outline shrink-0" onClick={() => setExtraOpen((o) => !o)}>
              {extraOpen ? "Cancel extra bus" : "Add an extra bus"}
            </button>
          </div>
          {trip?.problem && <p className="mt-3 text-xs font-semibold text-red-700">The server could not add this departure: {trip.problem}</p>}

          {extraOpen && (
            <form onSubmit={addExtra} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="x-route" className="label">Destination</label>
                <select id="x-route" className="input" value={extra.routeId} onChange={(e) => { const r = routes.find((x) => x.id === e.target.value); setExtra({ ...extra, routeId: e.target.value, fare: r ? String(r.fare) : extra.fare }); }}>
                  <option value="">Choose</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.destinationCity}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="x-bus" className="label">Bus</label>
                <select id="x-bus" className="input" value={extra.busId} onChange={(e) => setExtra({ ...extra, busId: e.target.value })}>
                  <option value="">Choose</option>
                  {buses.map((b) => <option key={b.id} value={b.id}>{b.busNumber} ({b.totalSeats} seats)</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="x-date" className="label">Date</label>
                <input id="x-date" type="date" className="input" value={extra.date} onChange={(e) => setExtra({ ...extra, date: e.target.value })} />
              </div>
              <div>
                <label htmlFor="x-time" className="label">Departure time</label>
                <input id="x-time" type="time" className="input" value={extra.time} onChange={(e) => setExtra({ ...extra, time: e.target.value })} />
              </div>
              <div>
                <label htmlFor="x-fare" className="label">Fare (XAF)</label>
                <input id="x-fare" inputMode="numeric" className="input" value={extra.fare} onChange={(e) => setExtra({ ...extra, fare: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <button type="submit" className="btn btn-primary">Add bus and start selling</button>
              </div>
            </form>
          )}
        </div>

        {issued && (
          <div className="card mb-6 p-5" role="status">
            <div className={`alert mb-4 ${issued.status === "synced" ? "alert-success" : "alert-info"}`}>
              Ticket <strong className="font-mono">{issued.sale.ref}</strong> issued for {formatXAF(issued.sale.amount)}.{" "}
              {issued.status === "synced"
                ? issued.sale.state === "flagged" && issued.sale.detail
                  ? issued.sale.detail
                  : "The seats are confirmed."
                : "Saved on this device. It uploads automatically when there is a connection. Print the ticket now."}
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <TicketSlip sale={issued.sale} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => print(issued.sale)}>Print ticket</button>
                <button type="button" className="btn btn-outline" onClick={() => setIssued(null)}>Next passenger</button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert alert-error mb-6" role="alert">{error}</div>}

        {trip ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SeatMap key={`${trip.key}-${mapKey}`} busId={trip.busId} tripId={trip.key} confirmLabel="Add passengers" onConfirm={chooseSeats} loader={loader} version={version} />

            <form onSubmit={issue} noValidate className="space-y-5">
              {seats.length === 0 ? (
                <div className="card p-8 text-center text-sm text-slate-500">Select seats on the bus to enter passenger details.</div>
              ) : (
                <>
                  {passengers.map((p, index) => (
                    <PassengerFields
                      key={String(p.seatId)}
                      index={index}
                      total={passengers.length}
                      seatLabel={seats[index].seatLabel}
                      value={p}
                      onChange={(value) => setPassengers((prev) => prev.map((x, i) => (i === index ? value : x)))}
                    />
                  ))}
                  <div className="card space-y-4 p-5">
                    <div>
                      <label htmlFor="counter-phone" className="label">Passenger phone (optional)</label>
                      <input id="counter-phone" type="tel" inputMode="numeric" className="input" placeholder="6XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <fieldset>
                      <legend className="label">Payment</legend>
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-2"><input type="radio" name="pay" checked={method === "cash"} onChange={() => setMethod("cash")} /> Cash</label>
                        <label className="flex items-center gap-2"><input type="radio" name="pay" checked={method === "momo"} onChange={() => setMethod("momo")} /> Mobile Money</label>
                      </div>
                      {method === "momo" && (
                        <div className="mt-3">
                          <label htmlFor="momo-ref" className="label">Transaction number from the SMS</label>
                          <input id="momo-ref" className="input" autoCapitalize="characters" value={momoRef} onChange={(e) => setMomoRef(e.target.value)} />
                          <p className="mt-1 text-xs text-slate-500">It is checked by a manager later; the ticket is valid now.</p>
                        </div>
                      )}
                    </fieldset>

                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} />
                      I am entering a paper ticket written earlier
                    </label>
                    {late && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="paper-ref" className="label">Number on the paper ticket</label>
                          <input id="paper-ref" className="input" maxLength={40} value={paperRef} onChange={(e) => setPaperRef(e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="sold-at" className="label">When it was sold</label>
                          <input id="sold-at" type="datetime-local" className="input" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                      <span className="text-slate-600">{seats.length} seat{seats.length > 1 ? "s" : ""} x {formatXAF(trip.fare)}</span>
                      <span className="text-lg font-bold text-primary">{formatXAF(total)}</span>
                    </div>
                    <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                      {submitting ? "Issuing ticket..." : method === "cash" ? `Confirm cash received (${formatXAF(total)})` : `Confirm Mobile Money received (${formatXAF(total)})`}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        ) : (
          <div className="card p-8 text-center text-sm text-slate-500">
            {empty ? "Connect to the internet once to download today's departures." : "There are no open departures saved on this device."}
          </div>
        )}

        <section className="card mt-8 p-5">
          <h2 className="text-sm font-bold text-slate-900">Today&apos;s summary</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Cash to hand over</p>
              <p className="text-lg font-bold text-slate-900">{formatXAF(summary.cashAmount)}</p>
              <p className="text-xs text-slate-500">{summary.cashSales} sales</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Mobile Money (to verify)</p>
              <p className="text-lg font-bold text-slate-900">{formatXAF(summary.momoAmount)}</p>
              <p className="text-xs text-slate-500">{summary.momoSales} sales</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Tickets sold</p>
              <p className="text-lg font-bold text-slate-900">{summary.tickets}</p>
              <p className="text-xs text-slate-500">{summary.waiting} not uploaded yet</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={printSummary}>Print summary</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void shareSummary()}>Share as message</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveBackup}>Save backup (CSV)</button>
          </div>
        </section>

        <section className="card mt-8 overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">Sold on this device</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Passengers</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Sold</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No sales yet.</td></tr>
                ) : (
                  sales.slice(0, 30).map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-mono text-xs font-bold text-slate-900">
                        {s.ref}
                        {s.paperRef && <span className="block font-sans text-[11px] font-normal text-slate-500">Paper {s.paperRef}</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{s.passengers.map((p) => `${p.name} (${p.seatLabel.replace(/^S/, "")})`).join(", ")}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {formatXAF(s.amount)}
                        <span className="block text-[11px] text-slate-500">{s.payment.method === "momo" ? "Mobile Money" : "Cash"}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">{formatDateTime(s.soldAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATE_BADGE[s.state].tone}`}>{STATE_BADGE[s.state].text}</span>
                        {s.detail && <span className="mt-1 block max-w-xs text-[11px] text-red-700">{s.detail}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => print(s)}>Print</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div id="print-ticket" className="hidden" aria-hidden>
        {printKind === "summary" ? (
          <DaySummarySheet summary={summary} agent={agentName} terminal={status.parkName} />
        ) : (
          slip && <TicketSlip sale={slip} />
        )}
      </div>
    </div>
  );
}
