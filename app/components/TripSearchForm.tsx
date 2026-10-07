"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { todayInCameroon } from "@/lib/format";
import type { Park } from "@/lib/types";

export interface SearchValues {
  from: string;
  to: string;
  date: string;
}

interface Props {
  parks?: Park[];
  initial?: Partial<SearchValues>;
  /** When provided the form calls this instead of navigating to the booking page. */
  onSearch?: (values: SearchValues) => void;
  submitLabel?: string;
}

function ParkOptions({ parks }: { parks: Park[] }) {
  const cities = Array.from(new Set(parks.map((park) => park.city)));
  return (
    <>
      {cities.map((city) => (
        <optgroup key={city} label={city}>
          {parks
            .filter((park) => park.city === city)
            .map((park) => (
              <option key={park.id} value={String(park.id)}>
                {city} - {park.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

export default function TripSearchForm({
  parks: initialParks,
  initial,
  onSearch,
  submitLabel = "Find buses",
}: Props) {
  const router = useRouter();
  const [parks, setParks] = useState<Park[]>(initialParks ?? []);
  const [loading, setLoading] = useState(!initialParks?.length);
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [date, setDate] = useState(initial?.date ?? todayInCameroon());
  const [error, setError] = useState("");

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialParks?.length) return;
    let active = true;
    api
      .get("/parks")
      .then(
        ({ data }) =>
          active && setParks(Array.isArray(data.parks) ? data.parks : []),
      )
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [initialParks, attempt]);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!from || !to)
      return setError(
        "Select where you are leaving from and where you are going.",
      );
    if (from === to)
      return setError(
        "The departure and destination terminals must be different.",
      );
    if (!date) return setError("Select your travel date.");
    setError("");

    const values = { from, to, date };
    if (onSearch) return onSearch(values);
    router.push(`/dashboard?from=${from}&to=${to}&date=${date}`);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_200px_auto] md:items-end">
        <div>
          <label htmlFor="search-from" className="label">
            Leaving from
          </label>
          <select
            id="search-from"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={loading || failed}
          >
            <option value="">
              {loading ? "Loading terminals..." : "Select terminal"}
            </option>
            <ParkOptions parks={parks} />
          </select>
        </div>

        <button
          type="button"
          onClick={swap}
          aria-label="Swap departure and destination"
          className="mx-auto hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-primary hover:text-primary md:flex"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
          </svg>
        </button>

        <div>
          <label htmlFor="search-to" className="label">
            Going to
          </label>
          <select
            id="search-to"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={loading || failed}
          >
            <option value="">
              {loading ? "Loading terminals..." : "Select terminal"}
            </option>
            <ParkOptions parks={parks} />
          </select>
        </div>

        <div>
          <label htmlFor="search-date" className="label">
            Travel date
          </label>
          <input
            id="search-date"
            type="date"
            className="input"
            value={date}
            min={todayInCameroon()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full md:w-auto md:px-7"
          disabled={loading || failed}
        >
          {submitLabel}
        </button>
      </div>

      {(error || failed) && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error || (
            <>
              We could not load the terminals.{" "}
              <button
                type="button"
                onClick={retry}
                className="font-semibold underline"
              >
                Try again
              </button>
            </>
          )}
        </p>
      )}
    </form>
  );
}
