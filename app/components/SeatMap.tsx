"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Seat } from "@/lib/types";

interface Props {
  busId: string | number;
  tripId: string | number;
  maxSeats?: number;
  confirmLabel?: string;
  onConfirm: (seats: Seat[]) => void;
}

const AGE_GROUPS = (age?: number | null) => {
  if (!age) return "Adult";
  if (age < 20) return "Teen";
  if (age <= 35) return "Young adult";
  if (age <= 55) return "Middle-aged";
  return "Senior";
};

const VIBE: Record<string, string> = {
  quiet: "Prefers a quiet journey",
  chatty: "Happy to chat",
  no_preference: "Flexible",
};

export default function SeatMap({
  busId,
  tripId,
  maxSeats = 8,
  confirmLabel = "Continue",
  onConfirm,
}: Props) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inspected, setInspected] = useState<Seat | null>(null);
  const [attempt, setAttempt] = useState(0);
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    let active = true;

    const fetchSeats = (silent: boolean) =>
      api
        .get(`/buses/${busId}/layout`, { params: { tripId } })
        .then(({ data }) => {
          if (!active) return;
          const next: Seat[] = data.seats;
          setSeats(next);
          setError("");

          // Another passenger may have taken a seat while this screen was open.
          const taken = next.filter(
            (s) => s.isBooked && selectedRef.current.includes(s.id),
          );
          if (taken.length > 0) {
            setSelected((prev) =>
              prev.filter((id) => !taken.some((s) => s.id === id)),
            );
            setNotice(
              `Seat ${taken.map((s) => s.seatLabel).join(", ")} was just taken. Please choose another.`,
            );
          }
        })
        .catch((err) => {
          if (active && !silent)
            setError(
              errorMessage(
                err,
                "We could not load the seat map. Please try again.",
              ),
            );
        })
        .finally(() => {
          if (active && !silent) setLoading(false);
        });

    fetchSeats(false);
    const timer = setInterval(() => fetchSeats(true), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [busId, tripId, attempt]);

  const toggle = (seat: Seat) => {
    if (seat.isAisle) return;
    if (seat.isBooked) {
      setInspected(seat);
      return;
    }
    setNotice("");
    setInspected(null);
    setSelected((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= maxSeats) {
        setNotice(`You can book up to ${maxSeats} seats at a time.`);
        return prev;
      }
      return [...prev, seat.id];
    });
  };

  if (loading) {
    return (
      <div
        className="skeleton mx-auto h-96 max-w-md rounded-xl"
        aria-label="Loading seat map"
      />
    );
  }

  if (error) {
    return (
      <div className="alert alert-error mx-auto max-w-md text-center">
        {error}{" "}
        <button
          type="button"
          className="font-semibold underline"
          onClick={() => {
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const chosen = seats.filter((seat) => selected.includes(seat.id));
  const columns = Math.max(...seats.map((s) => s.colNum), 6);
  const ordered = [...seats].sort(
    (a, b) => a.rowNum - b.rowNum || a.colNum - b.colNum,
  );

  return (
    <div className="card mx-auto max-w-md overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h3 className="text-base font-bold text-slate-900">
          Choose your seats
        </h3>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <i className="h-4 w-4 rounded-md border border-slate-300 bg-white" />
            Available
          </span>
          <span className="flex items-center gap-2">
            <i className="h-4 w-4 rounded-md bg-primary" />
            Selected
          </span>
          <span className="flex items-center gap-2">
            <i className="h-4 w-4 rounded-md bg-slate-200" />
            Taken
          </span>
        </div>
      </div>

      <div className="bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-xs rounded-t-[2.5rem] rounded-b-2xl border border-slate-300 bg-white px-4 pb-5 pt-4">
          <div className="mb-4 flex items-center justify-between border-b border-dashed border-slate-200 pb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Front</span>
            <span className="flex items-center gap-1.5">
              Driver
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M12 14.5V21M3.5 10.5L9.5 12M20.5 10.5L14.5 12" />
              </svg>
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {ordered.map((seat) => {
              if (seat.isAisle) return <div key={seat.id} aria-hidden />;
              const isSelected = selected.includes(seat.id);
              return (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => toggle(seat)}
                  aria-pressed={isSelected}
                  aria-label={`Seat ${seat.seatLabel} ${seat.isBooked ? "taken" : isSelected ? "selected" : "available"}`}
                  className={`flex aspect-square min-h-10 items-center justify-center rounded-lg border text-[11px] font-bold transition active:scale-95 ${
                    seat.isBooked
                      ? "border-slate-200 bg-slate-200 text-slate-400"
                      : isSelected
                        ? "border-primary bg-primary text-white shadow-md"
                        : "border-slate-300 bg-white text-slate-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {seat.seatLabel.replace(/^S/, "")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {inspected && (
        <div className="border-t border-slate-100 bg-slate-900 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">
              Seat {inspected.seatLabel} is taken
            </p>
            <button
              type="button"
              onClick={() => setInspected(null)}
              className="text-xs text-slate-400 hover:text-white"
              aria-label="Close"
            >
              Close
            </button>
          </div>
          {inspected.isCounterBooking ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Reserved in person at the terminal counter.
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Gender</dt>
                <dd className="mt-0.5 font-semibold capitalize">
                  {inspected.passengerGender || "Passenger"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Age group</dt>
                <dd className="mt-0.5 font-semibold">
                  {AGE_GROUPS(inspected.passengerAge)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Travel style</dt>
                <dd className="mt-0.5 font-semibold">
                  {VIBE[inspected.discussionPreference || "no_preference"]}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <div className="border-t border-slate-100 p-5">
        {notice && (
          <div className="alert alert-info mb-4 text-xs" role="status">
            {notice}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900">
              {chosen.length === 0
                ? "No seat selected"
                : `${chosen.length} seat${chosen.length > 1 ? "s" : ""} selected`}
            </p>
            {chosen.length > 0 && (
              <p className="truncate text-xs text-slate-500">
                {chosen.map((s) => s.seatLabel).join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
