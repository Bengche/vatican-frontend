"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TicketCard from "../components/TicketCard";
import { api, errorMessage } from "@/lib/api";
import { todayInCameroon } from "@/lib/format";
import type { BookingRecord } from "@/lib/types";

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/users/my-bookings")
      .then(({ data }) => active && setBookings(data.bookings ?? []))
      .catch((err) => active && setError(errorMessage(err, "We could not load your tickets. Please try again.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const today = todayInCameroon();
  const upcoming = bookings.filter((b) => b.travel_date >= today).sort((a, b) => a.travel_date.localeCompare(b.travel_date) || a.departure_time.localeCompare(b.departure_time));
  const past = bookings.filter((b) => b.travel_date < today);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">My tickets</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Your e-tickets and receipts</h1>
        </div>
        <Link href="/dashboard" className="btn btn-primary self-start sm:self-auto">Book a trip</Link>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-80 rounded-2xl" />)}</div>
      ) : bookings.length === 0 && !error ? (
        <div className="card p-10 text-center sm:p-14">
          <p className="text-base font-semibold text-slate-900">You have no tickets yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Once you book and pay for a trip, your e-ticket and receipt will appear here.</p>
          <Link href="/dashboard" className="btn btn-primary mt-6">Find a bus</Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming trips</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {upcoming.map((b) => <TicketCard key={b.booking_id} booking={b} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Past trips</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {past.map((b) => <TicketCard key={b.booking_id} booking={b} past />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
