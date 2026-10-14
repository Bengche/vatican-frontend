"use client";

import { QRCodeSVG } from "qrcode.react";
import { brand } from "@/config/brand";
import { formatDate, formatTime, formatXAF } from "@/lib/format";
import type { CounterSale } from "@/lib/offline/counterDb";

/** The ticket a counter hands over. Built on the device, so it prints with no network. */
export default function TicketSlip({ sale }: { sale: CounterSale }) {
  const momo = sale.payment.method === "momo";
  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-4 text-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-300 pb-3">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide">{brand.name}</p>
          <p className="text-[11px] text-slate-500">Passenger ticket</p>
        </div>
        <p className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">{sale.ref}</p>
      </div>

      <p className="mt-3 text-base font-bold">
        {sale.trip.originCity} to {sale.trip.destinationCity}
      </p>
      <p className="text-sm text-slate-700">
        {formatDate(sale.trip.travelDate)} at {formatTime(sale.trip.departureTime)} | Bus {sale.trip.busNumber}
      </p>

      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {sale.passengers.map((p) => (
          <li key={p.seatId} className="flex items-center justify-between gap-3 py-1.5">
            <span className="font-semibold uppercase">{p.name}</span>
            <span className="shrink-0 text-xs text-slate-600">Seat {p.seatLabel.replace(/^S/, "")}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-sm">
          <p className="font-bold">{formatXAF(sale.amount)}</p>
          <p className="text-[11px] text-slate-600">
            {momo ? `Paid by Mobile Money (${sale.payment.ref ?? "no number"})` : "Paid in cash"}
          </p>
          {sale.paperRef && <p className="text-[11px] text-slate-600">Paper ticket no. {sale.paperRef}</p>}
        </div>
        <QRCodeSVG value={sale.qrUrl} size={132} level="M" />
      </div>

      <p className="mt-3 border-t border-dashed border-slate-300 pt-2 text-[10px] leading-snug text-slate-500">
        Arrive {brand.boardingMinutes} minutes early with your ID. Present this ticket at boarding. {brand.support.phone}
      </p>
    </div>
  );
}
