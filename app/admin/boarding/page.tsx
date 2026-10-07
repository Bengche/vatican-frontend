"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { isAdmin, useUser } from "@/lib/auth";
import { downloadManifest } from "@/lib/download";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";

interface GateTrip {
  id: number | string;
  travel_date: string;
  departure_time: string;
  bus_number: string;
  origin_city: string;
  destination_city: string;
  booked_seats: string | number;
  boarded_seats: string | number;
}

interface Passenger {
  seat_label: string;
  passenger_name: string;
  id_card_number: string | null;
  booking_id: number | string;
  booking_ref: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
}

interface Found {
  booking_id: number | string;
  booking_ref: string;
  booking_status: string;
  travel_date: string;
  departure_time: string;
  origin_city: string;
  destination_city: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
  seats: { seat_label: string; passenger_name: string; id_card_number?: string | null }[];
}

export default function BoardingPage() {
  const user = useUser();
  const admin = isAdmin(user);

  const [trips, setTrips] = useState<GateTrip[] | null>(null);
  const [tripId, setTripId] = useState("");
  const [reload, setReload] = useState(0);
  const [manifest, setManifest] = useState<{ key: string; list: Passenger[]; error: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [lookup, setLookup] = useState("");
  const [found, setFound] = useState<{ booking: Found; today: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tripsError, setTripsError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/admin/gate/trips")
      .then(({ data }) => {
        if (!active) return;
        const list: GateTrip[] = data.trips ?? [];
        setTrips(list);
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Douala" });
        const preferred = list.find((t) => t.travel_date === today) ?? list[0];
        setTripId((current) => current || (preferred ? String(preferred.id) : ""));
      })
      .catch((err) => {
        if (!active) return;
        setTrips([]);
        setTripsError(errorMessage(err, "We could not load departures."));
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const manifestKey = `${tripId}|${reload}`;
  useEffect(() => {
    if (!tripId) return;
    let active = true;
    api
      .get(`/admin/gate/manifest/${tripId}`)
      .then(({ data }) => active && setManifest({ key: manifestKey, list: data.passengers ?? [], error: "" }))
      .catch((err) => active && setManifest({ key: manifestKey, list: [], error: errorMessage(err, "We could not load the passenger list.") }));
    return () => {
      active = false;
    };
  }, [tripId, manifestKey]);

  const trip = trips?.find((t) => String(t.id) === tripId) ?? null;
  const list = manifest?.key === manifestKey ? manifest.list : (manifest?.list ?? []);
  const boardedCount = list.filter((p) => p.is_checked_in).length;
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? list.filter((p) => [p.passenger_name, p.booking_ref, p.seat_label, p.id_card_number ?? ""].some((v) => v.toLowerCase().includes(needle)))
    : list;

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lookup.trim()) return;
    setBusy(true);
    setMessage(null);
    setFound(null);
    try {
      const { data } = await api.get("/admin/gate/lookup", { params: { q: lookup.trim() } });
      setFound({ booking: data.booking, today: data.today });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "No ticket matches that reference.") });
    } finally {
      setBusy(false);
    }
  };

  const board = async (bookingId: number | string, override = false) => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/admin/gate/check-in/${bookingId}`, { override });
      setMessage({ type: "success", text: data.message });
      setFound(null);
      setLookup("");
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not mark this passenger as boarded.") });
    } finally {
      setBusy(false);
    }
  };

  const undo = async (bookingId: number | string) => {
    if (!window.confirm("Remove the boarded mark from this booking?")) return;
    try {
      await api.post(`/admin/gate/undo/${bookingId}`);
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not undo the check-in.") });
    }
  };

  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (!trip) return;
    setDownloading(true);
    try {
      await downloadManifest(trip.id, `${trip.travel_date}-${trip.origin_city}-${trip.destination_city}`);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not download the manifest.") });
    } finally {
      setDownloading(false);
    }
  };

  const foundWarning = found
    ? found.booking.booking_status !== "confirmed"
      ? { tone: "red", text: `This ticket is ${found.booking.booking_status}. Do not board.` }
      : found.booking.is_checked_in
        ? { tone: "amber", text: `Already boarded ${formatDateTime(found.booking.checked_in_at)}.` }
        : found.booking.travel_date !== found.today
          ? { tone: "amber", text: `This ticket is for ${formatDate(found.booking.travel_date)}, not today.` }
          : null
    : null;

  const canBoard = found && found.booking.booking_status === "confirmed" && !found.booking.is_checked_in;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Boarding"
        title="Check passengers in"
        description="Look up a ticket by reference or scanned link, mark passengers as boarded and print the manifest for the driver."
      />

      {tripsError && (
        <div className="alert alert-error mb-5" role="alert">
          {tripsError}
        </div>
      )}
      {message && (
        <div className={`alert mb-5 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
          {message.text}
        </div>
      )}

      <section className="card mb-6 p-5">
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input"
            placeholder="Booking reference or scanned ticket link"
            aria-label="Booking reference"
            autoCapitalize="characters"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !lookup.trim()}>
            Find ticket
          </button>
        </form>

        {found && (
          <div className="mt-5 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-slate-900">{found.booking.booking_ref}</p>
              <p className="text-xs text-slate-500">
                {found.booking.origin_city} to {found.booking.destination_city}, {formatDate(found.booking.travel_date)} {formatTime(found.booking.departure_time)}
              </p>
            </div>
            {foundWarning && (
              <div className={`alert mt-3 ${foundWarning.tone === "red" ? "alert-error" : "alert-info"}`} role="alert">
                {foundWarning.text}
              </div>
            )}
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {found.booking.seats.map((s) => (
                <li key={s.seat_label} className="flex items-center justify-between py-2">
                  <span className="font-semibold uppercase text-slate-900">{s.passenger_name}</span>
                  <span className="text-xs text-slate-500">
                    Seat {s.seat_label} / ID {s.id_card_number || "-"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {canBoard && found.booking.travel_date === found.today && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => board(found.booking.booking_id)}>
                  Mark as boarded
                </button>
              )}
              {canBoard && found.booking.travel_date !== found.today && admin && (
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => board(found.booking.booking_id, true)}>
                  Board anyway
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="trip" className="label">
              Departure
            </label>
            <select id="trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
              {trips === null && <option>Loading...</option>}
              {trips?.length === 0 && <option value="">No departures</option>}
              {trips?.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatDate(t.travel_date)} {formatTime(t.departure_time)} | {t.origin_city} to {t.destination_city} | {Number(t.boarded_seats)}/{Number(t.booked_seats)} boarded
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">
              <span className="font-bold text-slate-900">{boardedCount}</span>
              <span className="text-slate-500"> of {list.length} boarded</span>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={download} disabled={!trip || downloading}>
              {downloading ? "Preparing..." : "Download manifest (PDF)"}
            </button>
          </div>
        </div>

        {manifest?.error && (
          <div className="alert alert-error m-5" role="alert">
            {manifest.error}
          </div>
        )}

        <div className="border-b border-slate-100 p-4">
          <input
            type="search"
            className="input h-10 sm:max-w-xs"
            placeholder="Filter by name, seat or reference"
            aria-label="Filter passengers"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Seat</th>
                <th className="px-5 py-3">Passenger</th>
                <th className="px-5 py-3">ID document</th>
                <th className="px-5 py-3">Booking</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    {tripId ? "No passengers to show." : "Select a departure."}
                  </td>
                </tr>
              ) : (
                visible.map((p) => (
                  <tr key={`${p.booking_id}-${p.seat_label}`}>
                    <td className="px-5 py-3.5 font-bold text-slate-900">{p.seat_label}</td>
                    <td className="px-5 py-3.5 font-semibold uppercase text-slate-900">{p.passenger_name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{p.id_card_number || "-"}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{p.booking_ref}</td>
                    <td className="px-5 py-3.5">
                      {p.is_checked_in ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Boarded</span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Not yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.is_checked_in ? (
                        admin && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => undo(p.booking_id)}>
                            Undo
                          </button>
                        )
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => board(p.booking_id)}>
                          Board
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}