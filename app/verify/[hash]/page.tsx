"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Logo from "../../components/Logo";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatTime, shiftLabel } from "@/lib/format";

interface Ticket {
  booking_ref: string;
  booking_status: string;
  agency_name: string;
  origin: string;
  destination: string;
  origin_city: string;
  destination_city: string;
  travel_date: string;
  departure_time: string;
  travel_shift: string;
  bus_number: string;
  bus_type?: string;
  passengers: {
    seat_label: string;
    passenger_name: string;
    id_card_number?: string;
    passenger_age?: number;
    passenger_gender?: string;
  }[];
}

type State =
  | { status: "loading" }
  | { status: "valid"; ticket: Ticket }
  | { status: "invalid"; message: string };

export default function VerifyTicketPage() {
  const { hash } = useParams<{ hash: string }>();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    api
      .get(`/verify/ticket/${hash}`)
      .then(({ data }) => {
        if (!active) return;
        setState(
          data.valid
            ? { status: "valid", ticket: data.ticket }
            : {
                status: "invalid",
                message: data.message || "This ticket is not valid for travel.",
              },
        );
      })
      .catch(
        (err) =>
          active &&
          setState({
            status: "invalid",
            message: errorMessage(
              err,
              "We could not verify this ticket right now.",
            ),
          }),
      );
    return () => {
      active = false;
    };
  }, [hash]);

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="bg-primary">
        <div className="mx-auto flex h-16 max-w-xl items-center px-4">
          <Link href="/">
            <Logo subtitle="" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        {state.status === "loading" && (
          <div
            className="skeleton h-96 rounded-xl"
            aria-label="Verifying ticket"
          />
        )}

        {state.status === "invalid" && (
          <div className="card overflow-hidden text-center">
            <div className="bg-red-600 px-6 py-8 text-white">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </div>
              <h1 className="mt-4 text-xl font-semibold">Ticket not valid</h1>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-slate-600">
                {state.message}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Do not allow boarding unless a valid ticket is presented.
              </p>
            </div>
          </div>
        )}

        {state.status === "valid" && (
          <div className="card overflow-hidden">
            <div className="bg-emerald-600 px-6 py-7 text-center text-white">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-4 text-xl font-semibold">Valid ticket</h1>
              <p className="mt-1 font-mono text-sm tracking-wider text-emerald-100">
                {state.ticket.booking_ref}
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    From
                  </p>
                  <p className="truncate text-lg font-bold text-slate-900">
                    {state.ticket.origin_city}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {state.ticket.origin}
                  </p>
                </div>
                <span className="text-xl font-bold text-accent">&rarr;</span>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    To
                  </p>
                  <p className="truncate text-lg font-bold text-slate-900">
                    {state.ticket.destination_city}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {state.ticket.destination}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Date
                  </dt>
                  <dd className="mt-1 font-bold text-slate-900">
                    {formatDate(state.ticket.travel_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Departure
                  </dt>
                  <dd className="mt-1 font-bold text-slate-900">
                    {formatTime(state.ticket.departure_time)}{" "}
                    {shiftLabel(state.ticket.travel_shift)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Coach
                  </dt>
                  <dd className="mt-1 font-bold text-slate-900">
                    {state.ticket.bus_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Class
                  </dt>
                  <dd className="mt-1 font-bold text-slate-900">
                    {state.ticket.bus_type || "Standard"}
                  </dd>
                </div>
              </dl>

              <h2 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Passenger manifest
              </h2>
              <ul className="mt-3 space-y-3">
                {state.ticket.passengers.map((p) => (
                  <li
                    key={p.seat_label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase text-slate-900">
                        {p.passenger_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        ID{" "}
                        <span className="font-mono font-semibold text-slate-800">
                          {p.id_card_number || "At boarding"}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-white">
                      Seat {p.seat_label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-center text-[11px] text-slate-400">
                Confirm each passenger&apos;s identity document matches the name
                above.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
