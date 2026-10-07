"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "../../components/PageHeader";
import SeatMap from "../../components/SeatMap";
import PassengerFields from "../../components/PassengerFields";
import { api, errorMessage } from "@/lib/api";
import { downloadTicket } from "@/lib/download";
import { formatDate, formatTime, formatXAF } from "@/lib/format";
import type { AdminTrip, PassengerInput, Seat } from "@/lib/types";

interface Issued { id: string | number; booking_ref: string; total_amount_fcfa: number }

function CounterSales() {
  const preselected = useSearchParams().get("tripId");
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripId, setTripId] = useState(preselected ?? "");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [passengers, setPassengers] = useState<PassengerInput[]>([]);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .get("/admin/trips")
      .then(({ data }) => {
        if (!active) return;
        const open: AdminTrip[] = (data.trips ?? []).filter((t: AdminTrip) => t.status === "open");
        setTrips(open);
        setTripId((current) => (current && open.some((t) => String(t.id) === current) ? current : open[0] ? String(open[0].id) : ""));
      })
      .catch((err) => active && setError(errorMessage(err, "We could not load departures.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const trip = trips.find((t) => String(t.id) === tripId) ?? null;
  const total = (trip?.price_fcfa ?? 0) * seats.length;

  const chooseSeats = (chosen: Seat[]) => {
    setSeats(chosen);
    setPassengers(chosen.map((seat) => ({ seatId: seat.id, name: "", idCardNumber: "", age: "", gender: "male" })));
    setError("");
  };

  const issue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip) return;
    for (const [index, p] of passengers.entries()) {
      const who = passengers.length > 1 ? ` for passenger ${index + 1}` : "";
      if (p.name.trim().length < 3) return setError(`Enter the passenger's full name${who}.`);
      if (p.idCardNumber.trim().length < 5) return setError(`Enter a valid ID document number${who}.`);
      const age = Number.parseInt(p.age, 10);
      if (!Number.isInteger(age) || age < 1 || age > 119) return setError(`Enter a valid age${who}.`);
    }

    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/admin/counter-booking", {
        tripId: trip.id,
        passengers: passengers.map((p) => ({ seatId: p.seatId, name: p.name.trim(), idCardNumber: p.idCardNumber.trim(), age: Number.parseInt(p.age, 10), gender: p.gender })),
        passengerPhone: phone,
      });
      setIssued(data.booking);
      setSeats([]);
      setPassengers([]);
      setPhone("");
      setMapKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err, "We could not issue this ticket."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Counter sales" title="Issue a walk-in ticket" description="Select a departure, assign seats, register each passenger's ID and confirm the cash received." />

      <div className="card mb-6 p-5">
        <label htmlFor="trip" className="label">Departure</label>
        <select id="trip" className="input" value={tripId} disabled={loading || trips.length === 0} onChange={(e) => { setTripId(e.target.value); setSeats([]); setPassengers([]); setIssued(null); setError(""); }}>
          {loading ? <option>Loading departures...</option> : trips.length === 0 ? <option>No open departures</option> : trips.map((t) => (
            <option key={t.id} value={t.id}>{t.origin_city} to {t.destination_city} | {formatDate(t.travel_date)} {formatTime(t.departure_time)} | {t.bus_number}</option>
          ))}
        </select>
      </div>

      {issued && (
        <div className="alert alert-success mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p>Ticket <strong className="font-mono">{issued.booking_ref}</strong> issued for {formatXAF(issued.total_amount_fcfa)}. Hand the printed ticket to the passenger.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadTicket(issued.id, issued.booking_ref).catch((err) => setError(errorMessage(err)))}>Print / download</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIssued(null)}>Next passenger</button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error mb-6" role="alert">{error}</div>}

      {trip ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <SeatMap key={`${trip.id}-${mapKey}`} busId={trip.bus_id} tripId={trip.id} confirmLabel="Add passengers" onConfirm={chooseSeats} />

          <form onSubmit={issue} noValidate className="space-y-5">
            {seats.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-500">Select seats on the coach to enter passenger details.</div>
            ) : (
              <>
                {passengers.map((p, index) => (
                  <PassengerFields key={String(p.seatId)} index={index} total={passengers.length} seatLabel={seats[index].seatLabel} value={p} onChange={(value) => setPassengers((prev) => prev.map((x, i) => (i === index ? value : x)))} />
                ))}
                <div className="card p-5">
                  <label htmlFor="counter-phone" className="label">Passenger phone (optional)</label>
                  <input id="counter-phone" type="tel" inputMode="numeric" className="input" placeholder="6XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                    <span className="text-slate-600">{seats.length} seat{seats.length > 1 ? "s" : ""} x {formatXAF(trip.price_fcfa)}</span>
                    <span className="text-lg font-extrabold text-primary">{formatXAF(total)}</span>
                  </div>
                  <button type="submit" className="btn btn-primary mt-4 w-full" disabled={submitting}>{submitting ? "Issuing ticket..." : `Confirm cash received (${formatXAF(total)})`}</button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : (
        !loading && <div className="card p-10 text-center text-sm text-slate-500">There are no open departures. Publish one from the Departures page.</div>
      )}
    </div>
  );
}

export default function CounterBookingPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <CounterSales />
    </Suspense>
  );
}
