"use client";

import { brand } from "@/config/brand";
import { formatDate, formatTime } from "@/lib/format";
import type { LocalBooking, LocalTrip } from "@/lib/offline/db";

/** The passenger list a driver carries, made from the data on the phone, so it prints with no network. */
export default function ManifestSheet({ trip, bookings }: { trip: LocalTrip; bookings: LocalBooking[] }) {
  const rows = bookings
    .filter((b) => b.status === "confirmed")
    .flatMap((b) => b.passengers.map((p) => ({ ...p, booking: b })))
    .sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));
  const boarded = rows.filter((r) => r.booking.boarded).length;

  return (
    <div className="w-full bg-white p-6 text-slate-900">
      <h1 className="text-xl font-extrabold">{brand.name}: passenger list</h1>
      <p className="mt-1 text-sm">
        {trip.origin_city} to {trip.destination_city} | {formatDate(trip.travel_date)} {formatTime(trip.departure_time)} | Bus {trip.bus_number}
      </p>
      <p className="text-xs text-slate-600">
        {rows.length} passengers, {boarded} marked as boarded on this device. Printed from saved data; tickets sold after the last update may be missing.
      </p>
      <table className="mt-4 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-1.5 pr-2">Seat</th>
            <th className="py-1.5 pr-2">Passenger</th>
            <th className="py-1.5 pr-2">ID document</th>
            <th className="py-1.5 pr-2">Ticket</th>
            <th className="py-1.5 text-center">Boarded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.booking.hash}-${r.seat}`} className="border-b border-slate-300">
              <td className="py-1.5 pr-2 font-bold">{r.seat.replace(/^S/, "")}</td>
              <td className="py-1.5 pr-2 font-semibold uppercase">{r.name}</td>
              <td className="py-1.5 pr-2 font-mono">{r.id || "-"}</td>
              <td className="py-1.5 pr-2 font-mono">
                {r.booking.ref}
                {r.booking.paper_ref ? ` (paper ${r.booking.paper_ref})` : ""}
              </td>
              <td className="py-1.5 text-center">{r.booking.boarded ? "X" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
