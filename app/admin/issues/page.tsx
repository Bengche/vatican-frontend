"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatTime, formatXAF } from "@/lib/format";
import type { Seat } from "@/lib/types";

interface SaleIssue {
  id: string;
  result: "flagged" | "rejected";
  detail: string | null;
  booking_ref: string | null;
  booking_id: string | null;
  late_entry: boolean;
  sold_at: string;
  device_label: string | null;
  agent: string | null;
  trip_id: string | null;
  bus_id: string | null;
  total_amount_fcfa: number | null;
  travel_date: string | null;
  departure_time: string | null;
  origin_city: string | null;
  destination_city: string | null;
  passengers: { seat_id: string; seat_label: string; name: string }[];
}

interface PaymentIssue {
  id: string;
  booking_ref: string;
  payment_ref: string | null;
  total_amount_fcfa: number;
  created_at: string;
  agent: string | null;
  origin_city: string;
  destination_city: string;
  travel_date: string;
}

interface GateIssue {
  id: string;
  result: "duplicate" | "rejected";
  detail: string | null;
  scanned_at: string;
  booking_ref: string | null;
  device_label: string | null;
  agent: string | null;
}

type Message = { type: "success" | "error"; text: string } | null;

export default function IssuesPage() {
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ key: number; sales: SaleIssue[]; payments: PaymentIssue[]; gate: GateIssue[]; error: string } | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [moving, setMoving] = useState<{ sale: SaleIssue; seats: Seat[]; from: string; to: string } | null>(null);
  const [resolving, setResolving] = useState<{ id: string; note: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get("/admin/issues")
      .then(({ data: d }) => active && setData({ key: reload, sales: d.sales ?? [], payments: d.payments ?? [], gate: d.gate ?? [], error: "" }))
      .catch((err) => active && setData({ key: reload, sales: [], payments: [], gate: [], error: errorMessage(err, "We could not load the items.") }));
    return () => {
      active = false;
    };
  }, [reload]);

  const loading = data?.key !== reload;
  const sales = data?.sales ?? [];
  const payments = data?.payments ?? [];
  const gate = data?.gate ?? [];

  const act = async (request: () => Promise<unknown>, success: string) => {
    setMessage(null);
    try {
      await request();
      setMessage({ type: "success", text: success });
      setMoving(null);
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "That did not work. Please try again.") });
    }
  };

  const startMove = async (sale: SaleIssue) => {
    setMessage(null);
    try {
      const { data: layout } = await api.get(`/buses/${sale.bus_id}/layout`, { params: { tripId: sale.trip_id } });
      setMoving({ sale, seats: layout.seats, from: sale.passengers[0]?.seat_id ?? "", to: "" });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not load the seats.") });
    }
  };

  const resolveSale = (sale: SaleIssue, note: string) =>
    act(() => api.post(`/admin/issues/sales/${sale.id}/resolve`, { note }), "Marked as handled.").then(() => setResolving(null));

  const total = sales.length + payments.length + gate.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Offline work"
        title="Needs attention"
        description="Things that came up while counters and scanners worked without internet: seats sold twice, sales the system could not accept, Mobile Money payments to check, and boardings that did not add up."
      />

      {message && (
        <div className={`alert mb-5 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
          {message.text}
        </div>
      )}
      {data?.error && <div className="alert alert-error mb-5" role="alert">{data.error}</div>}
      {!loading && !data?.error && total === 0 && (
        <div className="card p-8 text-center text-sm text-slate-600">Nothing needs attention. Everything uploaded by counters and scanners checked out.</div>
      )}

      {sales.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Seats sold twice and sales not accepted ({sales.length})</h2>
          <div className="space-y-4">
            {sales.map((sale) => (
              <div key={sale.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold text-slate-900">{sale.booking_ref ?? "No ticket created"}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${sale.result === "flagged" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                    {sale.result === "flagged" ? "Recorded, needs a decision" : "Not recorded: the passenger holds a ticket"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-800">{sale.detail}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {sale.origin_city && `${sale.origin_city} to ${sale.destination_city}, ${formatDate(sale.travel_date)} ${formatTime(sale.departure_time)}. `}
                  Sold {formatDateTime(sale.sold_at)} by {sale.agent ?? "unknown"} on {sale.device_label ?? "a device"}
                  {sale.late_entry ? " (paper ticket)" : ""}.
                </p>
                {sale.passengers.length > 0 && (
                  <ul className="mt-3 text-sm text-slate-700">
                    {sale.passengers.map((p) => (
                      <li key={p.seat_id}>{p.name} | Seat {p.seat_label.replace(/^S/, "")}</li>
                    ))}
                  </ul>
                )}

                {moving?.sale.id === sale.id && (
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 sm:items-end">
                    <div>
                      <label className="label" htmlFor={`from-${sale.id}`}>Passenger to move</label>
                      <select id={`from-${sale.id}`} className="input" value={moving.from} onChange={(e) => setMoving({ ...moving, from: e.target.value })}>
                        {sale.passengers.map((p) => (
                          <option key={p.seat_id} value={p.seat_id}>{p.name} (seat {p.seat_label.replace(/^S/, "")})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`to-${sale.id}`}>New seat</label>
                      <select id={`to-${sale.id}`} className="input" value={moving.to} onChange={(e) => setMoving({ ...moving, to: e.target.value })}>
                        <option value="">Choose a free seat</option>
                        {moving.seats.filter((s) => !s.isAisle && !s.isBooked).map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>Seat {s.seatLabel.replace(/^S/, "")}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!moving.to || !moving.from}
                      onClick={() => void act(() => api.post("/admin/issues/move-seat", { bookingId: sale.booking_id, fromSeatId: moving.from, toSeatId: moving.to }), "Passenger moved. Tell them their new seat.")}
                    >
                      Move passenger
                    </button>
                  </div>
                )}

                {resolving?.id === sale.id && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="input"
                      placeholder="What was done? (for example: moved the passenger to seat 12)"
                      aria-label="What was done"
                      maxLength={300}
                      value={resolving.note}
                      onChange={(e) => setResolving({ id: sale.id, note: e.target.value })}
                    />
                    <button type="button" className="btn btn-primary shrink-0" onClick={() => void resolveSale(sale, resolving.note)}>Save</button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {sale.booking_id && sale.bus_id && sale.passengers.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void startMove(sale)}>Move a passenger to another seat</button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResolving({ id: sale.id, note: "" })}>Mark as handled</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {payments.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Mobile Money to verify ({payments.length})</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Transaction number</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Sold by</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-slate-900">
                      {p.booking_ref}
                      <span className="block font-sans text-[11px] font-normal text-slate-500">{p.origin_city} to {p.destination_city}, {formatDate(p.travel_date)}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{p.payment_ref ?? "missing"}</td>
                    <td className="px-5 py-3 font-semibold">{formatXAF(p.total_amount_fcfa)}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{p.agent ?? "-"}<br />{formatDateTime(p.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void act(() => api.post(`/admin/issues/payments/${p.id}/verify`), "Payment marked as verified.")}>
                        Payment received
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {gate.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Boardings that did not add up ({gate.length})</h2>
          <div className="space-y-3">
            {gate.map((event) => (
              <div key={event.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="font-mono">{event.booking_ref ?? "Unknown ticket"}</span>{" "}
                    <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${event.result === "duplicate" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                      {event.result === "duplicate" ? "Scanned twice" : "Boarded with a ticket that was not valid"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.scanned_at)} by {event.agent ?? "unknown"} on {event.device_label ?? "a device"}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void act(() => api.post(`/admin/issues/gate/${event.id}/resolve`), "Marked as handled.")}>
                  Mark as handled
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
