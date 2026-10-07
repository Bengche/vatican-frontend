"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type { AdminTrip, Bus } from "@/lib/types";

export default function FleetPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [fleetError, setFleetError] = useState("");

  const [tripId, setTripId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/admin/buses"), api.get("/admin/trips")])
      .then(([busRes, tripRes]) => {
        if (!active) return;
        setBuses(busRes.data.buses ?? []);
        setTrips(
          (tripRes.data.trips ?? []).filter(
            (t: AdminTrip) => t.status === "open",
          ),
        );
      })
      .catch(
        (err) =>
          active &&
          setFleetError(errorMessage(err, "We could not load fleet data.")),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const toggleBus = async (bus: Bus) => {
    try {
      await api.patch(`/admin/buses/${bus.id}/status`, {
        isActive: !bus.is_active,
      });
      setBuses((prev) =>
        prev.map((b) =>
          b.id === bus.id ? { ...b, is_active: !bus.is_active } : b,
        ),
      );
    } catch (err) {
      setFleetError(errorMessage(err, "We could not update this coach."));
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setFeedback(null);
    try {
      const { data } = await api.post("/admin/broadcast", {
        tripId,
        subject: subject.trim(),
        messageBody: body.trim(),
      });
      setFeedback({ type: "success", text: data.message });
      setSubject("");
      setBody("");
    } catch (err) {
      setFeedback({
        type: "error",
        text: errorMessage(err, "We could not send the notice."),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Fleet and notices"
        title="Coach availability and passenger notices"
        description="Take coaches out of service and email everyone booked on a departure."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">Coaches</h2>
            <p className="mt-1 text-xs text-slate-500">
              Grounded coaches cannot be assigned to new departures.
            </p>
          </div>
          {fleetError && (
            <div className="alert alert-error m-4" role="alert">
              {fleetError}
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {buses.length === 0 && (
              <li className="p-8 text-center text-sm text-slate-500">
                {loading ? "Loading..." : "No coaches registered yet."}
              </li>
            )}
            {buses.map((bus) => (
              <li
                key={bus.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {bus.bus_number}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bus.total_seats} seats &middot; {bus.bus_type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBus(bus)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${bus.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                >
                  {bus.is_active ? "Operational" : "Grounded"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={send} className="card space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Notify passengers
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              A branded email is sent to every confirmed passenger with an email
              address.
            </p>
          </div>
          {feedback && (
            <div
              className={`alert ${feedback.type === "success" ? "alert-success" : "alert-error"}`}
              role="status"
            >
              {feedback.text}
            </div>
          )}
          <div>
            <label htmlFor="notice-trip" className="label">
              Departure
            </label>
            <select
              id="notice-trip"
              className="input"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              required
            >
              <option value="">Select a departure</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.origin_city} to {t.destination_city} |{" "}
                  {formatDate(t.travel_date)} {formatTime(t.departure_time)} |{" "}
                  {t.bus_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notice-subject" className="label">
              Subject
            </label>
            <input
              id="notice-subject"
              className="input"
              maxLength={150}
              placeholder="Departure time changed"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="notice-body" className="label">
              Message
            </label>
            <textarea
              id="notice-body"
              className="input"
              rows={5}
              maxLength={2000}
              placeholder="Explain the change clearly: new time, boarding point or replacement coach."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={sending}
          >
            {sending ? "Sending..." : "Send notice"}
          </button>
        </form>
      </div>
    </div>
  );
}
