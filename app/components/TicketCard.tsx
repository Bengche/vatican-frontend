"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { brand } from "@/config/brand";
import { downloadTicket } from "@/lib/download";
import { errorMessage } from "@/lib/api";
import { formatDate, formatTime, formatXAF, shiftLabel } from "@/lib/format";
import type { BookingRecord } from "@/lib/types";

export default function TicketCard({ booking, past = false }: { booking: BookingRecord; past?: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const verifyUrl = `${brand.siteUrl}/verify/${booking.qr_code_hash}`;
  const counter = booking.payment_method === "cash_counter";

  const download = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadTicket(booking.booking_id, booking.booking_ref);
    } catch (err) {
      setError(errorMessage(err, "We could not download this ticket. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className={`card relative overflow-hidden ${past ? "opacity-80" : ""}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="-rotate-[28deg] select-none whitespace-nowrap text-5xl font-black uppercase tracking-widest text-primary/[0.035]">{brand.name}</span>
      </div>

      <header className="relative flex items-center justify-between gap-3 bg-primary px-5 py-3.5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">E-ticket</p>
        <p className="font-mono text-sm font-bold tracking-wider">{booking.booking_ref}</p>
      </header>

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold tracking-tight text-slate-900">
              {booking.origin_city} <span className="text-accent">&rarr;</span> {booking.destination_city}
            </p>
            <p className="mt-1 text-xs text-slate-500">{booking.origin_park} to {booking.destination_park}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${counter ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {counter ? "Counter sale" : "Paid"}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-dashed border-slate-200 pt-5 text-sm sm:grid-cols-4">
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</dt><dd className="mt-1 font-bold text-slate-900">{formatDate(booking.travel_date)}</dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Departs</dt><dd className="mt-1 font-bold text-slate-900">{formatTime(booking.departure_time)} <span className="text-xs font-medium text-slate-500">{shiftLabel(booking.travel_shift)}</span></dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Coach</dt><dd className="mt-1 font-bold text-slate-900">{booking.bus_number}</dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</dt><dd className="mt-1 font-bold text-emerald-700">{formatXAF(booking.total_amount_fcfa)}</dd></div>
        </dl>

        <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white/70">
          {booking.seats.map((seat) => (
            <li key={seat.seat_label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate font-semibold uppercase text-slate-900">{seat.passenger_name}</span>
              <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-white">Seat {seat.seat_label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-dashed border-slate-200 pt-5">
          <div className="space-y-2">
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} disabled={downloading} className="btn btn-primary btn-sm">
                {downloading ? "Preparing..." : "Download PDF"}
              </button>
              <Link href={`/verify/${booking.qr_code_hash}`} className="btn btn-outline btn-sm">Verify ticket</Link>
            </div>
            <p className="text-[11px] text-slate-500">Arrive {brand.boardingMinutes} minutes early with your ID.</p>
          </div>
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2">
            <QRCodeSVG value={verifyUrl} size={84} level="M" fgColor={brand.colors.primary} />
          </div>
        </div>
      </div>
    </article>
  );
}
