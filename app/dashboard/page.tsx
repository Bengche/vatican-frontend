"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TripSearchForm, {
  type SearchValues,
} from "../components/TripSearchForm";
import SeatMap from "../components/SeatMap";
import Checkout from "../components/Checkout";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatTime, formatXAF } from "@/lib/format";
import type { Seat, Trip } from "@/lib/types";

type Stage = "search" | "seats" | "checkout";

const STAGES: { key: Stage; label: string }[] = [
  { key: "search", label: "Route" },
  { key: "seats", label: "Seats" },
  { key: "checkout", label: "Payment" },
];

function Stepper({ stage }: { stage: Stage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol
      className="flex items-center gap-2 text-xs font-semibold sm:gap-3"
      aria-label="Booking progress"
    >
      {STAGES.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2 sm:gap-3">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${index <= current ? "bg-primary text-white" : "bg-slate-200 text-slate-500"}`}
          >
            {index + 1}
          </span>
          <span
            className={index === current ? "text-slate-900" : "text-slate-500"}
          >
            {item.label}
          </span>
          {index < STAGES.length - 1 && (
            <span className="h-px w-4 bg-slate-300 sm:w-8" />
          )}
        </li>
      ))}
    </ol>
  );
}

function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const date = params.get("date") ?? "";

  const [stage, setStage] = useState<Stage>("search");
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    trips: Trip[];
    error: string;
  } | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);

  const searched = Boolean(from && to && date);
  const key = `${from}|${to}|${date}|${nonce}`;
  const loading = searched && result?.key !== key;
  const trips = result?.key === key ? result.trips : [];
  const error = result?.key === key ? result.error : "";

  // Links from the home page arrive with the search already filled in.
  useEffect(() => {
    if (!searched) return;
    let active = true;
    api
      .get("/trips/search", {
        params: { fromPark: from, toPark: to, travelDate: date },
      })
      .then(
        ({ data }) =>
          active && setResult({ key, trips: data.trips ?? [], error: "" }),
      )
      .catch(
        (err) =>
          active &&
          setResult({
            key,
            trips: [],
            error: errorMessage(
              err,
              "We could not search departures right now. Please try again.",
            ),
          }),
      );
    return () => {
      active = false;
    };
  }, [searched, key, from, to, date]);

  const handleSearch = (values: SearchValues) => {
    setStage("search");
    setTrip(null);
    setSeats([]);
    if (values.from === from && values.to === to && values.date === date)
      setNonce((n) => n + 1);
    else
      router.replace(
        `/dashboard?from=${values.from}&to=${values.to}&date=${values.date}`,
      );
  };

  const reset = () => {
    setStage("search");
    setTrip(null);
    setSeats([]);
    router.replace("/dashboard");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Book a ticket</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Plan your journey
          </h1>
        </div>
        <Stepper stage={stage} />
      </div>

      {stage === "search" && (
        <>
          <div className="card p-5 sm:p-7">
            <TripSearchForm
              initial={{ from, to, date: date || undefined }}
              onSearch={handleSearch}
            />
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {searched && (
            <section aria-live="polite">
              {loading ? (
                <div className="space-y-4">
                  {[0, 1].map((i) => (
                    <div key={i} className="skeleton h-28 rounded-xl" />
                  ))}
                </div>
              ) : trips.length === 0 && !error ? (
                <div className="card p-10 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    No departures found for this route and date
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Try another date or a nearby terminal. New departures are
                    published every day.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    {trips.length} departure{trips.length === 1 ? "" : "s"}{" "}
                    available
                  </h2>
                  {trips.map((item) => (
                    <article
                      key={item.id}
                      className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                    >
                      <div className="flex items-center gap-5">
                        <div className="text-center">
                          <p className="text-3xl font-bold tracking-tight text-slate-900">
                            {formatTime(item.departureTime)}
                          </p>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Departs
                          </p>
                        </div>
                        <div className="h-12 w-px bg-slate-200" />
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900">
                            {item.fromCity}{" "}
                            <span className="text-accent">&rarr;</span>{" "}
                            {item.toCity}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.fromParkName} to {item.toParkName}
                          </p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>{formatDate(item.travelDate)}</span>
                            <span>{item.busType || "Standard"}</span>
                            <span
                              className={
                                item.availableSeats <= 5
                                  ? "font-semibold text-red-600"
                                  : ""
                              }
                            >
                              {item.availableSeats} seat
                              {item.availableSeats === 1 ? "" : "s"} left
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                        <p className="text-xl font-bold text-primary">
                          {formatXAF(item.price)}
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={item.availableSeats === 0}
                          onClick={() => {
                            setTrip(item);
                            setStage("seats");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          {item.availableSeats === 0
                            ? "Sold out"
                            : "Select seats"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {stage === "seats" && trip && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStage("search")}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            &larr; Back to departures
          </button>
          <div className="card mx-auto max-w-md p-5">
            <p className="text-lg font-bold tracking-tight text-slate-900">
              {trip.fromCity} <span className="text-accent">&rarr;</span>{" "}
              {trip.toCity}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(trip.travelDate)} at {formatTime(trip.departureTime)}{" "}
              &middot; {trip.busType || "Standard"} &middot;{" "}
              {formatXAF(trip.price)} per seat
            </p>
          </div>
          <SeatMap
            busId={trip.busId}
            tripId={trip.id}
            confirmLabel="Continue"
            onConfirm={(chosen) => {
              setSeats(chosen);
              setStage("checkout");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}

      {stage === "checkout" && trip && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStage("seats")}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            &larr; Back to seat selection
          </button>
          <Checkout
            trip={trip}
            seats={seats}
            onBack={() => setStage("seats")}
            onReset={reset}
          />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-xl" />}>
      <BookingFlow />
    </Suspense>
  );
}
