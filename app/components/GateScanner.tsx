"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import jsQR from "jsqr";
import { errorMessage, isNetworkError } from "@/lib/api";
import { isAdmin, useUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import * as gate from "@/lib/offline/gate";
import type { GateStatus, ScanResult } from "@/lib/offline/gate";
import { getBookingByRef, searchBookings } from "@/lib/offline/db";
import type { LocalBooking } from "@/lib/offline/db";
import { parseScan } from "@/lib/offline/qr";
import { checkPin, hasPin, pinSupported, savePin } from "@/lib/offline/pin";

type Phase =
  | "loading"
  | "unsupported"
  | "setup"
  | "pin-setup"
  | "locked"
  | "ready"
  | "revoked";

const REFRESH_MS = 10 * 60_000;
const STALE_MS = 24 * 3_600_000;
const IDLE_LOCK_MS = 5 * 60_000;
const MAX_PIN_TRIES = 5;

interface Detector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

const TONES = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-900",
} as const;

const toneOf = (kind: ScanResult["kind"]) =>
  kind === "ok"
    ? TONES.green
    : kind === "cancelled" || kind === "forged"
      ? TONES.red
      : TONES.amber;

const TITLES: Record<ScanResult["kind"], string> = {
  ok: "Valid ticket",
  unlisted: "Genuine ticket",
  already: "Already boarded",
  cancelled: "Do not board",
  "wrong-day": "Wrong day",
  "unknown-trip": "Departure not on this device",
  forged: "Do not board",
  unknown: "Cannot check this ticket",
};

function ago(ms: number | null, now: number) {
  if (!ms) return "never";
  const minutes = Math.floor((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

export default function GateScanner() {
  const user = useUser();
  const userId = user ? String(user.id) : null;
  const admin = isAdmin(user);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [now, setNow] = useState(0);
  const [restart, setRestart] = useState(0);
  const [status, setStatus] = useState<GateStatus>({
    pending: 0,
    bundleAt: null,
    bookings: 0,
    issues: [],
  });
  const [syncing, setSyncing] = useState(false);
  const [reachable, setReachable] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [label, setLabel] = useState("");
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [pinError, setPinError] = useState("");
  const [tries, setTries] = useState(0);
  const [formBusy, setFormBusy] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [matches, setMatches] = useState<LocalBooking[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [boarding, setBoarding] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(false);
  const lastActive = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await gate.getStatus());
    } catch {
      setStatus((current) => current);
    }
  }, []);

  // Work out which screen to show: set up, locked, or ready to scan.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      if (typeof indexedDB === "undefined") return "unsupported";
      if (await gate.isRevoked(userId)) return "revoked";
      if (!(await gate.getDeviceId(userId))) return "setup";
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
    if (phase === "loading" || phase === "unsupported") return;
    const tick = () => setNow(Date.now());
    const timer = window.setTimeout(() => {
      tick();
      void refreshStatus();
    }, 0);
    const clock = window.setInterval(tick, 30_000);
    const off = gate.onGateChange(refreshStatus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clock);
      off();
    };
  }, [phase, refreshStatus]);

  const sync = useCallback(
    async (force: boolean) => {
      if (!userId || !navigator.onLine) return;
      setSyncing(true);
      try {
        await gate.ping(userId);
        await gate.flushQueue(userId);
        const current = await gate.getStatus();
        if (force || !current.bundleAt || Date.now() - current.bundleAt > REFRESH_MS) {
          await gate.downloadBundle(userId);
        }
        if (force) setNotice({ type: "success", text: "Up to date." });
        setReachable(true);
      } catch (error) {
        if (error instanceof gate.DeviceRevokedError) setPhase("revoked");
        else if (error instanceof gate.DeviceMissingError) setPhase("setup");
        else {
          // A phone can report "connected" while the network carries no data.
          if (isNetworkError(error)) setReachable(false);
          if (force) setNotice({ type: "error", text: errorMessage(error, "We could not sync right now. Your scans are safe on this device.") });
        }
      } finally {
        setSyncing(false);
      }
    },
    [userId],
  );

  // Keep the device in step with the server whenever a connection is available.
  useEffect(() => {
    if (phase !== "ready") return;
    const run = () => void sync(false);
    const first = window.setTimeout(run, 0);
    const interval = window.setInterval(run, 30_000);
    window.addEventListener("online", run);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("online", run);
    };
  }, [phase, sync]);

  // Save this screen for offline use so the scanner still opens with no connection.
  useEffect(() => {
    if (phase !== "ready" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) =>
        registration.active?.postMessage({ type: "PRECACHE", urls: [window.location.pathname] }),
      )
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
        setScanning(false);
        setResult(null);
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

  const handleScan = useCallback(
    async (text: string) => {
      if (pausedRef.current) return;
      pausedRef.current = true;
      try {
        const next = await gate.evaluate(text, { admin });
        navigator.vibrate?.(next.canBoard ? 60 : [120, 60, 120]);
        setNotice(null);
        setMatches([]);
        setResult(next);
      } catch {
        pausedRef.current = false;
        setNotice({ type: "error", text: "We could not read that ticket. Please try again." });
      }
    },
    [admin],
  );
  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  // Camera scanning: the browser's built-in detector when present, otherwise a bundled decoder.
  useEffect(() => {
    if (!scanning || phase !== "ready") return;
    let stop = false;
    let timer = 0;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (stop || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();

        const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (stop) return;
          if (!pausedRef.current && video.readyState >= 2 && video.videoWidth > 0) {
            let value: string | null = null;
            try {
              if (detector) {
                value = (await detector.detect(video))[0]?.rawValue ?? null;
              } else if (context) {
                const scale = Math.min(1, 640 / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                value = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
              }
            } catch {
              value = null;
            }
            if (value) void handleScanRef.current(value);
          }
          timer = window.setTimeout(tick, 200);
        };
        void tick();
      } catch {
        setCameraError("The camera could not be opened. Allow camera access, or type the ticket code instead.");
        setScanning(false);
      }
    })();

    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, phase]);

  const nextTicket = () => {
    setResult(null);
    pausedRef.current = false;
  };

  const confirmBoarding = async () => {
    if (!result || !userId) return;
    setBoarding(true);
    try {
      await gate.board(userId, result);
      setNotice({ type: "success", text: `Boarded ${result.booking?.ref ?? ""}.` });
      nextTicket();
    } catch {
      setNotice({ type: "error", text: "We could not save this boarding. Please try again." });
    } finally {
      setBoarding(false);
    }
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = manual.trim();
    if (!text) return;
    setManual("");
    const scan = parseScan(text);
    if (scan.hash || (scan.ref && (await getBookingByRef(scan.ref)))) {
      pausedRef.current = false;
      return handleScan(text);
    }
    const found = await searchBookings(text);
    pausedRef.current = false;
    if (found.length === 1) return handleScan(found[0].hash);
    if (found.length === 0) return handleScan(text);
    setResult(null);
    setMatches(found);
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setFormBusy(true);
    setNotice(null);
    try {
      await gate.registerDevice(userId, label.trim());
      setRestart((n) => n + 1);
    } catch (error) {
      setNotice({
        type: "error",
        text: online
          ? errorMessage(error, "We could not set up this device.")
          : "Connect to the internet once to set up this device.",
      });
    } finally {
      setFormBusy(false);
    }
  };

  const createPin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPinError("");
    if (!/^\d{4,6}$/.test(pin)) return setPinError("Use 4 to 6 digits.");
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
        setPinError(
          used >= MAX_PIN_TRIES
            ? "Too many wrong attempts. Sign out and sign in again to reset this device."
            : "Wrong PIN.",
        );
      }
    } finally {
      setFormBusy(false);
    }
  };

  const tripLine = (trip: ScanResult["trip"]) =>
    trip
      ? `${trip.origin_city} to ${trip.destination_city}, ${formatDate(trip.travel_date)} ${formatTime(trip.departure_time)}, bus ${trip.bus_number}`
      : "";

  const stale = status.bundleAt !== null && now - status.bundleAt > STALE_MS;
  const connected = online && reachable;
  const empty = status.bundleAt === null;

  if (phase === "loading" || !userId) return null;

  const shell = (children: React.ReactNode) => (
    <section className="card mb-6 p-5" aria-label="Scanner">
      {children}
    </section>
  );

  if (phase === "unsupported") {
    return shell(
      <p className="text-sm text-slate-600">
        This browser cannot store data for offline scanning. Use a recent version of Chrome, Edge, Firefox or Safari.
      </p>,
    );
  }

  if (phase === "revoked") {
    return shell(
      <div className="alert alert-error" role="alert">
        This device has been disabled by an administrator and its downloaded data was removed.
        {status.pending > 0 && ` ${status.pending} boarding(s) saved here were not sent.`} Contact your administrator.
      </div>,
    );
  }

  if (phase === "setup") {
    return shell(
      <form onSubmit={register} className="max-w-md space-y-3">
        <h2 className="text-base font-bold text-slate-900">Set up this device for offline scanning</h2>
        <p className="text-sm text-slate-600">
          Do this once while you have internet. Afterwards this phone can scan tickets with no connection for days.
        </p>
        {notice && <div className={`alert ${notice.type === "error" ? "alert-error" : "alert-success"}`}>{notice.text}</div>}
        <label htmlFor="device-label" className="label">Device name</label>
        <input id="device-label" className="input" placeholder="Gate phone" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={formBusy || !label.trim() || !online}>
          {formBusy ? "Setting up..." : "Set up device"}
        </button>
        {!online && <p className="text-xs text-amber-700">You are offline. Connect to the internet to continue.</p>}
      </form>,
    );
  }

  if (phase === "pin-setup") {
    return shell(
      <form onSubmit={createPin} className="max-w-md space-y-3">
        <h2 className="text-base font-bold text-slate-900">Choose a PIN for this device</h2>
        <p className="text-sm text-slate-600">The scanner locks after a few idle minutes and asks for this PIN, so a lost phone cannot be used to board people.</p>
        {pinError && <div className="alert alert-error" role="alert">{pinError}</div>}
        <input className="input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="4 to 6 digits" maxLength={6} aria-label="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <input className="input" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Repeat PIN" maxLength={6} aria-label="Repeat PIN" value={pinAgain} onChange={(e) => setPinAgain(e.target.value.replace(/\D/g, ""))} />
        <button type="submit" className="btn btn-primary" disabled={formBusy}>Save PIN</button>
      </form>,
    );
  }

  if (phase === "locked") {
    return shell(
      <form onSubmit={unlock} className="max-w-xs space-y-3">
        <h2 className="text-base font-bold text-slate-900">Scanner locked</h2>
        {status.pending > 0 && <p className="text-xs text-slate-500">{status.pending} boarding(s) waiting to sync.</p>}
        {pinError && <div className="alert alert-error" role="alert">{pinError}</div>}
        <input className="input" type="password" inputMode="numeric" autoComplete="off" placeholder="PIN" maxLength={6} aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} disabled={tries >= MAX_PIN_TRIES} />
        <button type="submit" className="btn btn-primary" disabled={formBusy || pin.length < 4 || tries >= MAX_PIN_TRIES}>Unlock</button>
      </form>,
    );
  }

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {connected ? "Online" : "No connection: scanning from saved list"}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${status.pending ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
          {status.pending ? `${status.pending} waiting to sync` : "Everything synced"}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${empty || stale ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
          {empty ? "No offline list yet" : `List updated ${ago(status.bundleAt, now)}, ${status.bookings} tickets`}
        </span>
        <button type="button" className="btn btn-outline btn-sm ml-auto" disabled={!online || syncing} onClick={() => void sync(true)}>
          {syncing ? "Syncing..." : "Sync and update list"}
        </button>
      </div>

      {(empty || stale) && (
        <div className="alert alert-error mt-3" role="alert">
          {empty
            ? "Connect to the internet and press Sync and update list before you lose your connection."
            : "The saved list is more than a day old. Tickets sold since then are not on it."}
        </div>
      )}
      {notice && <div className={`alert mt-3 ${notice.type === "error" ? "alert-error" : "alert-success"}`} role="status">{notice.text}</div>}
      {cameraError && <div className="alert alert-error mt-3" role="alert">{cameraError}</div>}

      {status.issues.length > 0 && (
        <div className="alert alert-info mt-3" role="status">
          <p className="font-semibold">Needs attention after syncing:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {status.issues.slice(0, 5).map((issue) => (
              <li key={issue.id}>
                {issue.ref}: {issue.detail || issue.result}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => void gate.dismissIssues()}>Dismiss</button>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <button
            type="button"
            className={`btn ${scanning ? "btn-outline" : "btn-primary"} mb-3`}
            onClick={() => {
              setCameraError("");
              pausedRef.current = false;
              setScanning((on) => !on);
            }}
          >
            {scanning ? "Stop camera" : "Scan ticket with camera"}
          </button>
          {scanning && (
            <video ref={videoRef} className="aspect-square w-full max-w-sm rounded-xl bg-black object-cover" muted playsInline />
          )}

          <form onSubmit={submitManual} className="mt-3 flex gap-2">
            <input className="input" placeholder="Ticket code, reference or passenger name" aria-label="Ticket code, reference or passenger name" autoCapitalize="characters" value={manual} onChange={(e) => setManual(e.target.value)} />
            <button type="submit" className="btn btn-outline shrink-0" disabled={!manual.trim()}>Find</button>
          </form>

          {matches.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {matches.map((m) => (
                <li key={m.hash}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50" onClick={() => { pausedRef.current = false; void handleScan(m.hash); }}>
                    <span className="min-w-0 truncate font-semibold uppercase text-slate-900">{m.passengers.map((p) => p.name).join(", ") || m.ref}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">{m.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {result ? (
            <div className={`rounded-xl border p-4 ${toneOf(result.kind)}`} role="alert">
              <p className="text-lg font-bold">{TITLES[result.kind]}</p>
              <p className="mt-1 text-sm">{result.message}</p>
              {result.kind === "already" && result.booking?.boarded_at && (
                <p className="mt-1 text-xs">Boarded {formatDateTime(result.booking.boarded_at)}.</p>
              )}
              {result.booking && (
                <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-slate-900">
                  <p className="font-mono text-xs font-bold">{result.booking.ref}</p>
                  {result.trip && <p className="mt-0.5 text-xs text-slate-600">{tripLine(result.trip)}</p>}
                  <ul className="mt-2 space-y-1">
                    {result.booking.passengers.map((p) => (
                      <li key={p.seat} className="flex justify-between gap-3">
                        <span className="font-semibold uppercase">{p.name}</span>
                        <span className="text-xs text-slate-600">Seat {p.seat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {result.canBoard && (
                  <button type="button" className="btn btn-primary" disabled={boarding} onClick={confirmBoarding}>
                    {boarding ? "Saving..." : "Confirm boarding"}
                  </button>
                )}
                {!result.canBoard && result.canOverride && (
                  <button type="button" className="btn btn-outline" disabled={boarding} onClick={confirmBoarding}>Board anyway</button>
                )}
                <button type="button" className="btn btn-ghost" onClick={nextTicket}>Next ticket</button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Scan a ticket or type its code. Results appear here, even with no internet.
            </p>
          )}
        </div>
      </div>
    </>,
  );
}
