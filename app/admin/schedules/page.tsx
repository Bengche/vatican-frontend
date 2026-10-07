"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import {
  formatDate,
  formatTime,
  formatXAF,
  todayInCameroon,
} from "@/lib/format";
import type { AdminTrip, Bus, Park } from "@/lib/types";

const EMPTY = {
  originParkId: "",
  destinationParkId: "",
  busId: "",
  departureDate: "",
  departureTime: "07:00",
  farePrice: "",
};

export default function SchedulesPage() {
  const [parks, setParks] = useState<Park[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadTrips = useCallback(async () => {
    const { data } = await api.get("/admin/trips");
    setTrips(data.trips ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/parks"),
      api.get("/admin/buses"),
      api.get("/admin/trips"),
    ])
      .then(([parksRes, busesRes, tripsRes]) => {
        if (!active) return;
        setParks(parksRes.data.parks ?? []);
        setBuses((busesRes.data.buses ?? []).filter((b: Bus) => b.is_active));
        setTrips(tripsRes.data.trips ?? []);
      })
      .catch(
        (err) =>
          active &&
          setMessage({
            type: "error",
            text: errorMessage(err, "We could not load schedule data."),
          }),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const update = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (form.originParkId === form.destinationParkId)
      return setMessage({
        type: "error",
        text: "The departure and destination terminals must be different.",
      });

    setSubmitting(true);
    try {
      await api.post("/admin/schedules", {
        ...form,
        farePrice: Number(form.farePrice),
      });
      setMessage({
        type: "success",
        text: "Departure published. Passengers can book it immediately.",
      });
      setForm((prev) => ({
        ...EMPTY,
        originParkId: prev.originParkId,
        destinationParkId: prev.destinationParkId,
        busId: prev.busId,
      }));
      await loadTrips();
    } catch (err) {
      setMessage({
        type: "error",
        text: errorMessage(err, "We could not publish this departure."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (trip: AdminTrip) => {
    if (
      !window.confirm(
        `Withdraw the ${formatTime(trip.departure_time)} departure from ${trip.origin_city} to ${trip.destination_city}?`,
      )
    )
      return;
    try {
      await api.patch(`/admin/trips/${trip.id}/cancel`);
      await loadTrips();
    } catch (err) {
      setMessage({
        type: "error",
        text: errorMessage(err, "We could not withdraw this departure."),
      });
    }
  };

  const select = (
    name: string,
    label: string,
    options: { value: string | number; label: string }[],
  ) => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="input"
        value={form[name as keyof typeof form]}
        onChange={update}
        required
      >
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const parkOptions = parks.map((p) => ({
    value: p.id,
    label: `${p.city} - ${p.name}`,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Departures"
        title="Schedule and fares"
        description="Publish coach departures. Seats become available to passengers immediately."
      />

      {message && (
        <div
          className={`alert mb-6 ${message.type === "success" ? "alert-success" : "alert-error"}`}
          role="status"
        >
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="card mb-8 space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">
          Publish a departure
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {select("originParkId", "Departure terminal", parkOptions)}
          {select("destinationParkId", "Destination terminal", parkOptions)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {select(
            "busId",
            "Coach",
            buses.map((b) => ({
              value: b.id,
              label: `${b.bus_number} (${b.total_seats} seats, ${b.bus_type})`,
            })),
          )}
          <div>
            <label htmlFor="farePrice" className="label">
              Fare per seat (XAF)
            </label>
            <input
              id="farePrice"
              name="farePrice"
              type="number"
              inputMode="numeric"
              min={500}
              step={100}
              className="input"
              placeholder="6000"
              value={form.farePrice}
              onChange={update}
              required
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="departureDate" className="label">
              Travel date
            </label>
            <input
              id="departureDate"
              name="departureDate"
              type="date"
              className="input"
              min={todayInCameroon()}
              value={form.departureDate}
              onChange={update}
              required
            />
          </div>
          <div>
            <label htmlFor="departureTime" className="label">
              Departure time
            </label>
            <input
              id="departureTime"
              name="departureTime"
              type="time"
              className="input"
              value={form.departureTime}
              onChange={update}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full sm:w-auto"
          disabled={submitting || loading}
        >
          {submitting ? "Publishing..." : "Publish departure"}
        </button>
      </form>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-900">
            Upcoming departures
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {trips.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Departure</th>
                <th className="px-5 py-3">Coach</th>
                <th className="px-5 py-3">Fare</th>
                <th className="px-5 py-3">Sold</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    {loading
                      ? "Loading..."
                      : "No upcoming departures. Publish the first one above."}
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr
                    key={trip.id}
                    className={trip.status === "cancelled" ? "opacity-50" : ""}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {trip.origin_city} &rarr; {trip.destination_city}
                      </p>
                      <p className="text-xs text-slate-500">
                        {trip.origin_park}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {formatDate(trip.travel_date)}
                      <br />
                      <span className="font-semibold">
                        {formatTime(trip.departure_time)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                      {trip.bus_number}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {formatXAF(trip.price_fcfa)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {Number(trip.booked_seats)}/{trip.total_seats}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {trip.status === "open" ? (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/counter-booking?tripId=${trip.id}`}
                            className="btn btn-outline btn-sm"
                          >
                            Sell ticket
                          </Link>
                          <button
                            type="button"
                            onClick={() => cancel(trip)}
                            className="btn btn-danger btn-sm"
                          >
                            Withdraw
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold uppercase text-slate-400">
                          {trip.status}
                        </span>
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
