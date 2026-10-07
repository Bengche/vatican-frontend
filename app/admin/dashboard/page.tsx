"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatTime, formatXAF } from "@/lib/format";

type Period = "today" | "week" | "month" | "custom";

interface Stats {
  total_tickets?: string | number;
  total_revenue?: string | number;
  momo_revenue?: string | number;
  counter_revenue?: string | number;
}
interface Agency {
  agency_id: number | string;
  agency_name: string;
  city: string;
  tickets_sold: string | number;
  revenue_fcfa: string | number;
}
interface Underbooked {
  trip_id: number | string;
  travel_date: string;
  departure_time: string;
  bus_number: string;
  total_seats: number;
  origin: string;
  destination: string;
  booked_seats: string | number;
  occupancy_rate: string | number;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "custom", label: "Custom" },
];

export default function AdminOverviewPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState<{
    key: string;
    error: string;
    stats: Stats;
    agencies: Agency[];
    underbooked: Underbooked[];
  } | null>(null);

  const ready = period !== "custom" || Boolean(startDate && endDate);
  const key = `${period}|${startDate}|${endDate}`;
  const loading = ready && result?.key !== key;
  const current = result?.key === key ? result : null;
  const error = current?.error ?? "";
  const stats = current?.stats ?? {};
  const agencies = current?.agencies ?? [];
  const underbooked = current?.underbooked ?? [];

  useEffect(() => {
    if (!ready) return;
    let active = true;
    api
      .get("/admin/analytics", { params: { period, startDate, endDate } })
      .then(({ data }) => {
        if (active)
          setResult({
            key,
            error: "",
            stats: data.stats ?? {},
            agencies: data.agencies ?? [],
            underbooked: data.underbooked ?? [],
          });
      })
      .catch((err) => {
        if (active)
          setResult({
            key,
            error: errorMessage(err, "We could not load the metrics."),
            stats: {},
            agencies: [],
            underbooked: [],
          });
      });
    return () => {
      active = false;
    };
  }, [ready, key, period, startDate, endDate]);

  const kpis = [
    {
      label: "Agency revenue",
      value: formatXAF(stats.total_revenue),
      hint: "Mobile Money payouts plus counter cash",
    },
    {
      label: "Tickets sold",
      value: String(Number(stats.total_tickets || 0)),
      hint: "Seats confirmed",
    },
    {
      label: "Mobile Money",
      value: formatXAF(stats.momo_revenue),
      hint: "Fare and terminal fee paid to the agency",
    },
    {
      label: "Counter cash",
      value: formatXAF(stats.counter_revenue),
      hint: "Cash collected at the counter",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Overview"
        title="Sales and operations"
        description="Ticket volume, revenue by channel and terminal performance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {PERIODS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriod(item.key)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${period === item.key ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Start date"
                  className="input h-10 w-auto"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  aria-label="End date"
                  className="input h-10 w-auto"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
        }
      />

      {error && (
        <div className="alert alert-error mb-6" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? (
                <span className="skeleton inline-block h-7 w-32 rounded" />
              ) : (
                kpi.value
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">
              Terminal performance
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Agency revenue by departure terminal for the selected period.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Terminal</th>
                  <th className="px-5 py-3">Tickets</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agencies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      {loading ? "Loading..." : "No sales in this period."}
                    </td>
                  </tr>
                ) : (
                  agencies.map((agency) => (
                    <tr key={agency.agency_id}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">
                          {agency.agency_name}
                        </p>
                        <p className="text-xs text-slate-500">{agency.city}</p>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {Number(agency.tickets_sold)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                        {formatXAF(agency.revenue_fcfa)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">
              Departures below 40% capacity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Upcoming buses that need more passengers.
            </p>
          </div>
          <div className="space-y-3 p-4">
            {underbooked.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {loading
                  ? "Loading..."
                  : "All upcoming departures are filling well."}
              </p>
            ) : (
              underbooked.map((trip) => (
                <div
                  key={trip.trip_id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {trip.origin} &rarr; {trip.destination}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(trip.travel_date)} at{" "}
                        {formatTime(trip.departure_time)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                      {Number(trip.occupancy_rate)}%
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{
                        width: `${Math.min(Number(trip.occupancy_rate), 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {trip.bus_number}: {Number(trip.booked_seats)}/
                      {trip.total_seats} seats
                    </span>
                    <Link
                      href={`/admin/counter-booking?tripId=${trip.trip_id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      Sell seats &rarr;
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
