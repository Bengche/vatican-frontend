"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TicketCard from "../components/TicketCard";
import { api, errorMessage, isNetworkError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatDateTime, todayInCameroon } from "@/lib/format";
import type { BookingRecord } from "@/lib/types";

function readSaved(key: string): { savedAt: number; bookings: BookingRecord[] } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const cacheKey = `tickets-cache:${getUser()?.id ?? "anon"}`;

    api
      .get("/users/my-bookings")
      .then(({ data }) => {
        if (!active) return;
        const list: BookingRecord[] = data.bookings ?? [];
        setBookings(list);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), bookings: list }));
        } catch {
          // Storage can be full or disabled; the live list still works.
        }
      })
      .catch((err) => {
        if (!active) return;
        const saved = isNetworkError(err) ? readSaved(cacheKey) : null;
        if (saved) {
          setBookings(saved.bookings);
          setSavedAt(saved.savedAt);
        } else {
          setError(errorMessage(err, "We could not load your tickets. Please try again."));
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const today = todayInCameroon();
  const upcoming = bookings
    .filter((b) => b.travel_date >= today)
    .sort(
      (a, b) =>
        a.travel_date.localeCompare(b.travel_date) ||
        a.departure_time.localeCompare(b.departure_time),
    );
  const past = bookings.filter((b) => b.travel_date < today);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">My tickets</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Your e-tickets and receipts
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="btn btn-primary self-start sm:self-auto"
        >
          Book a trip
        </Link>
      </div>

      {savedAt && (
        <div className="alert alert-info" role="status">
          You are offline. Showing the tickets saved on this device on {formatDateTime(new Date(savedAt).toISOString())}.
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-80 rounded-xl" />
          ))}
        </div>
      ) : bookings.length === 0 && !error ? (
        <div className="card p-10 text-center sm:p-14">
          <p className="text-base font-semibold text-slate-900">
            You have no tickets yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Once you book and pay for a trip, your e-ticket and receipt will
            appear here.
          </p>
          <Link href="/dashboard" className="btn btn-primary mt-6">
            Find a bus
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                Upcoming trips
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {upcoming.map((b) => (
                  <TicketCard key={b.booking_id} booking={b} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                Past trips
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {past.map((b) => (
                  <TicketCard key={b.booking_id} booking={b} past />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
