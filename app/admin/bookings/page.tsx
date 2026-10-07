"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatDateTime, formatTime, formatXAF } from "@/lib/format";

interface Row {
  id: number | string;
  booking_ref: string;
  status: string;
  payment_method: string;
  total_amount_fcfa: number;
  created_at: string;
  is_checked_in: boolean;
  travel_date: string;
  departure_time: string;
  origin_city: string;
  destination_city: string;
  passengers: string | null;
}

interface Detail {
  booking: {
    booking_id: number | string;
    booking_ref: string;
    booking_status: string;
    payment_method: string;
    total_amount_fcfa: number;
    travel_date: string;
    departure_time: string;
    origin_city: string;
    destination_city: string;
    bus_number: string;
    passenger_phone?: string | null;
    recipient_email?: string | null;
    is_checked_in?: boolean;
    checked_in_at?: string | null;
    cancelled_at?: string | null;
    cancel_reason?: string | null;
    seats: { seat_label: string; passenger_name: string; id_card_number?: string | null }[];
    breakdown: { baseFare: number; fees: number; total: number };
  };
  refundSuggestion: { hoursToDeparture: number; percent: number; amount: number; maxAmount: number } | null;
  payouts: { id: number | string; kind: string; amount_fcfa: number; status: string; error?: string | null; created_at: string }[];
}

function BookingPanel({ id, onClose, onChanged }: { id: string | number; onClose: () => void; onChanged: () => void }) {
  const [reload, setReload] = useState(0);
  const key = `${id}|${reload}`;
  const [result, setResult] = useState<{ key: string; detail: Detail | null; error: string } | null>(null);
  const [reason, setReason] = useState("");
  const [refundInput, setRefundInput] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/admin/bookings/${id}`)
      .then(({ data }) => active && setResult({ key, detail: data, error: "" }))
      .catch((err) => active && setResult({ key, detail: null, error: errorMessage(err, "We could not load this booking.") }));
    return () => {
      active = false;
    };
  }, [id, key]);

  const current = result?.key === key ? result : null;
  const detail = current?.detail ?? null;
  const booking = detail?.booking;
  const suggestion = detail?.refundSuggestion;
  const refund = refundInput ?? String(suggestion?.amount ?? 0);
  const isCash = booking?.payment_method === "cash_counter";

  const cancel = async () => {
    if (!booking) return;
    const amount = Number.parseInt(refund, 10);
    if (reason.trim().length < 3) return setMessage({ type: "error", text: "Enter the reason for the cancellation." });
    if (!Number.isInteger(amount) || amount < 0) return setMessage({ type: "error", text: "Enter a valid refund amount." });
    if (
      !window.confirm(
        `Cancel booking ${booking.booking_ref} and ${amount > 0 ? `refund ${formatXAF(amount)}${isCash ? " in cash" : " by Mobile Money"}` : "give no refund"}? This cannot be undone.`,
      )
    )
      return;

    setSubmitting(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/admin/bookings/${id}/cancel`, { reason: reason.trim(), refundAmount: amount });
      const failed = data.refund?.status === "failed";
      setMessage({
        type: failed ? "error" : "success",
        text: failed
          ? "The booking is cancelled but the refund payment failed. Retry it from the Payouts page."
          : data.message,
      });
      setReason("");
      setRefundInput(null);
      setReload((n) => n + 1);
      onChanged();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not cancel this booking.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Booking details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-base font-bold text-slate-900">Booking {booking?.booking_ref ?? ""}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Close
          </button>
        </div>

        {!current ? (
          <div className="p-5">
            <div className="skeleton h-64 rounded-xl" />
          </div>
        ) : !booking ? (
          <div className="p-5">
            <div className="alert alert-error">{current.error}</div>
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={booking.booking_status} />
              {booking.is_checked_in && (
                <span className="text-xs font-semibold text-emerald-700">Boarded {formatDateTime(booking.checked_in_at)}</span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="col-span-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Route</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {booking.origin_city} to {booking.destination_city}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Departure</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {formatDate(booking.travel_date)} {formatTime(booking.departure_time)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bus</dt>
                <dd className="mt-1 font-semibold text-slate-900">{booking.bus_number}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {formatXAF(booking.total_amount_fcfa)} ({isCash ? "cash" : "Mobile Money"})
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</dt>
                <dd className="mt-1 truncate font-semibold text-slate-900">
                  {booking.passenger_phone || booking.recipient_email || "-"}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Passengers</h3>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {booking.seats.map((seat) => (
                  <li key={seat.seat_label} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold uppercase text-slate-900">{seat.passenger_name}</p>
                      <p className="text-xs text-slate-500">ID {seat.id_card_number || "-"}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-bold text-white">Seat {seat.seat_label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {booking.booking_status === "cancelled" && (
              <div className="alert alert-info">
                Cancelled {formatDateTime(booking.cancelled_at)}
                {booking.cancel_reason ? `: ${booking.cancel_reason}` : "."}
              </div>
            )}

            {detail.payouts.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payments sent out</h3>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {detail.payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                      <span className="capitalize text-slate-700">
                        {p.kind} {formatXAF(p.amount_fcfa)}
                      </span>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {booking.booking_status === "confirmed" && suggestion && (
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900">Cancel and refund</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Departure in {suggestion.hoursToDeparture} hours. Policy refund: {suggestion.percent}% of the fare, {formatXAF(suggestion.amount)}.
                  Fees are not refunded under the policy.
                </p>

                {message && (
                  <div className={`alert mt-3 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
                    {message.text}
                  </div>
                )}

                <label htmlFor="reason" className="label mt-4">
                  Reason
                </label>
                <textarea
                  id="reason"
                  rows={2}
                  className="input"
                  placeholder="For example: passenger request, illness, bus breakdown"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />

                <label htmlFor="refund" className="label mt-4">
                  Refund amount (XAF)
                </label>
                <input
                  id="refund"
                  type="number"
                  min={0}
                  max={suggestion.maxAmount}
                  className="input"
                  value={refund}
                  onChange={(e) => setRefundInput(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRefundInput(String(suggestion.amount))}>
                    Policy amount
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRefundInput(String(suggestion.maxAmount))}>
                    Everything paid
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRefundInput("0")}>
                    No refund
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isCash ? "Hand the cash back at the counter. It is deducted from the agent's expected cash." : "The refund is sent to the Mobile Money number that paid."}
                </p>

                <button type="button" onClick={cancel} disabled={submitting} className="btn btn-danger mt-4 w-full">
                  {submitting ? "Cancelling..." : "Cancel booking"}
                </button>
              </div>
            )}

            {booking.booking_status !== "confirmed" && message && (
              <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState<string | number | null>(null);
  const [result, setResult] = useState<{ key: string; rows: Row[]; error: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(timer);
  }, [q]);

  const key = `${debounced}|${status}|${reload}`;
  const loading = result?.key !== key;

  useEffect(() => {
    let active = true;
    api
      .get("/admin/bookings", { params: { q: debounced, status } })
      .then(({ data }) => active && setResult({ key, rows: data.bookings ?? [], error: "" }))
      .catch((err) => active && setResult({ key, rows: [], error: errorMessage(err, "We could not load bookings.") }));
    return () => {
      active = false;
    };
  }, [key, debounced, status]);

  const rows = result?.key === key ? result.rows : (result?.rows ?? []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Bookings"
        title="Find, cancel and refund"
        description="Search by booking reference, passenger name, ID number or phone. Open a booking to cancel it and refund the passenger."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          className="input sm:max-w-sm"
          placeholder="Reference, name, ID number or phone"
          aria-label="Search bookings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:w-48" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {result?.error && (
        <div className="alert alert-error mb-5" role="alert">
          {result.error}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Passengers</th>
                <th className="px-5 py-3">Trip</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    {loading ? "Loading..." : "No bookings match your search."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-bold text-slate-900">{row.booking_ref}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                    </td>
                    <td className="max-w-56 truncate px-5 py-3.5 text-slate-700">{row.passengers}</td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {row.origin_city} to {row.destination_city}
                      <br />
                      <span className="text-xs text-slate-500">
                        {formatDate(row.travel_date)} {formatTime(row.departure_time)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                      {formatXAF(row.total_amount_fcfa)}
                      <br />
                      <span className="text-xs font-normal text-slate-500">{row.payment_method === "cash_counter" ? "Cash" : "Mobile Money"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button type="button" onClick={() => setOpenId(row.id)} className="btn btn-outline btn-sm">
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openId !== null && (
        <BookingPanel id={openId} onClose={() => setOpenId(null)} onChanged={() => setReload((n) => n + 1)} />
      )}
    </div>
  );
}