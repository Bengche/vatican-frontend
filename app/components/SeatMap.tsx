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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!inspected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspected(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [inspected]);

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
  const columns = Math.max(...seats.map((s) => s.colNum), 1);
  const describe = (seat: Seat) =>
    `${seat.seatLabel.replace(/^S/, "")}${seat.isWindow ? " (window)" : ""}`;
  const rows = [...seats]
    .sort((a, b) => a.rowNum - b.rowNum || a.colNum - b.colNum)
    .reduce<Seat[][]>((acc, seat) => {
      const last = acc[acc.length - 1];
      if (last && last[0].rowNum === seat.rowNum) last.push(seat);
      else acc.push([seat]);
      return acc;
    }, []);

  const seatButton = (seat: Seat, style?: React.CSSProperties) => {
    const isSelected = selected.includes(seat.id);
    const state = seat.isBooked
      ? "taken"
      : isSelected
        ? "selected"
        : "available";
    const bar = seat.isBooked
      ? "bg-slate-300"
      : isSelected
        ? "bg-white/70"
        : "bg-accent";
    return (
      <button
        key={seat.id}
        type="button"
        style={style}
        onClick={() => toggle(seat)}
        aria-pressed={isSelected}
        aria-label={`Seat ${seat.seatLabel.replace(/^S/, "")}${seat.isWindow ? ", window" : ""}, ${state}`}
        title={seat.isWindow ? "Window seat" : undefined}
        className={`relative flex aspect-square min-h-10 items-center justify-center rounded-lg border text-[11px] font-bold transition active:scale-95 ${
          seat.isBooked
            ? "cursor-pointer border-slate-200 bg-slate-200 text-slate-400 hover:bg-slate-300"
            : isSelected
              ? "border-primary bg-primary text-white shadow-md"
              : "border-slate-300 bg-white text-slate-700 hover:border-primary hover:text-primary"
        }`}
      >
        {seat.isWindow && (
          <span
            aria-hidden
            className={`absolute inset-y-1.5 w-1 rounded-full ${bar} ${seat.colNum === 1 ? "left-1" : "right-1"}`}
          />
        )}
        {seat.seatLabel.replace(/^S/, "")}
        {seat.isBooked && (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary/60"
          />
        )}
      </button>
    );
  };

  const renderRow = (row: Seat[]) => {
    const isBench = row.every((seat) => !seat.isAisle);
    if (isBench) {
      // Back seats have no aisle and are centred, so a short row never looks lopsided.
      return (
        <div key={row[0].rowNum} className="flex justify-center gap-2">
          {row.map((seat) =>
            seatButton(seat, {
              width: `calc((100% - ${(columns - 1) * 0.5}rem) / ${columns})`,
            }),
          )}
        </div>
      );
    }

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < row.length; i += 1) {
      const seat = row[i];
      const place = (span = 1): React.CSSProperties => ({
        gridColumn: `${seat.colNum} / span ${span}`,
      });

      if (seat.seatLabel === "DOOR") {
        let span = 1;
        while (row[i + span]?.seatLabel === "DOOR") span += 1;
        i += span - 1;
        cells.push(
          <div
            key={seat.id}
            style={place(span)}
            aria-label="Door"
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M6 3h9a1 1 0 011 1v17H6V3zm10 9h3m-1.5-1.5L19 12l-1.5 1.5M12 12h.01" />
            </svg>
            Door
          </div>,
        );
      } else if (seat.seatLabel === "DRIVER") {
        cells.push(
          <div
            key={seat.id}
            style={place()}
            aria-label="Driver seat, not available"
            className="flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-500"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2.5" />
              <path d="M12 14.5V21M3.5 10.5L9.5 12M20.5 10.5L14.5 12" />
            </svg>
            <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider">
              Driver
            </span>
          </div>,
        );
      } else if (seat.isAisle) {
        cells.push(<div key={seat.id} style={place()} aria-hidden />);
      } else {
        cells.push(seatButton(seat, place()));
      }
    }

    return (
      <div
        key={row[0].rowNum}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells}
      </div>
    );
  };

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
            <i className="relative h-4 w-4 rounded-md bg-slate-200">
              <b className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-primary/60" />
            </i>
            Taken
          </span>
          <span className="flex items-center gap-2">
            <i className="relative h-4 w-4 rounded-md border border-slate-300 bg-white">
              <b className="absolute inset-y-0.5 left-0.5 w-0.5 rounded-full bg-accent" />
            </i>
            Window
          </span>
        </div>

        {seats.some((seat) => seat.isBooked && !seat.isAisle) && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-accent-dark"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5" />
            </svg>
            <p className="text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-900">
                Know who you sit beside.
              </span>{" "}
              Tap any taken seat (marked with a small dot) to see who is
              travelling there: gender, age group and travel style.
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-4 sm:p-6">
        <div
          className={`mx-auto ${columns === 5 ? "max-w-[17rem]" : "max-w-xs"} rounded-t-[2.5rem] rounded-b-2xl border border-slate-300 bg-white px-4 pb-5 pt-4`}
        >
          <div className="mb-4 border-b border-dashed border-slate-200 pb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Front
          </div>

          <div className="space-y-2">{rows.map(renderRow)}</div>

          <div className="mt-4 border-t border-dashed border-slate-200 pt-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Rear
          </div>
        </div>
      </div>

      {inspected && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setInspected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="modal-panel flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="min-w-0">
                <p className="eyebrow">Occupied seat</p>
                <h4
                  id="seat-modal-title"
                  className="mt-1 font-display text-xl font-semibold text-slate-900"
                >
                  Seat {inspected.seatLabel.replace(/^S/, "")}
                  {inspected.isWindow ? " · Window" : ""}
                </h4>
              </div>
              <button
                type="button"
                ref={closeRef}
                onClick={() => setInspected(null)}
                className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              {inspected.isCounterBooking ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  This seat was reserved in person at the terminal counter.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-slate-600">
                    This seat has already been booked. Here is a little about
                    your future neighbour.
                  </p>
                  <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {[
                      [
                        "Gender",
                        inspected.passengerGender || "Passenger",
                        "capitalize",
                      ],
                      ["Age group", AGE_GROUPS(inspected.passengerAge), ""],
                      [
                        "Travel style",
                        VIBE[inspected.discussionPreference || "no_preference"],
                        "",
                      ],
                    ].map(([label, value, extra]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                      >
                        <dt className="text-slate-500">{label}</dt>
                        <dd
                          className={`text-right font-semibold text-slate-900 ${extra}`}
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                onClick={() => setInspected(null)}
                className="btn btn-primary w-full"
              >
                Choose another seat
              </button>
            </div>
          </div>
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
                {chosen.map(describe).join(", ")}
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
