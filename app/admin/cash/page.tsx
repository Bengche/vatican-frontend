"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { isAdmin, useUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, formatXAF, todayInCameroon } from "@/lib/format";

interface AgentRow {
  agentId: string;
  name: string;
  bookings: number;
  tickets: number;
  sales: number;
  refunds: number;
  expected: number;
  handover: { counted: number; variance: number; note: string | null; recordedAt: string; recordedBy: string | null } | null;
}

function AdminCash() {
  const [date, setDate] = useState(todayInCameroon());
  const [reload, setReload] = useState(0);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<{ key: string; agents: AgentRow[]; error: string } | null>(null);

  const key = `${date}|${reload}`;
  const loading = result?.key !== key;

  useEffect(() => {
    let active = true;
    api
      .get("/admin/cash/report", { params: { date } })
      .then(({ data }) => active && setResult({ key, agents: data.agents ?? [], error: "" }))
      .catch((err) => active && setResult({ key, agents: [], error: errorMessage(err, "We could not load the cash report.") }));
    return () => {
      active = false;
    };
  }, [key, date]);

  const agents = result?.agents ?? [];

  const save = async (agent: AgentRow) => {
    const counted = Number.parseInt(counts[agent.agentId] ?? "", 10);
    if (!Number.isInteger(counted) || counted < 0) return setMessage({ type: "error", text: "Enter the amount of cash counted." });
    try {
      const { data } = await api.post("/admin/cash/handover", {
        agentId: agent.agentId,
        date,
        countedAmount: counted,
        note: notes[agent.agentId] ?? "",
      });
      setMessage({
        type: data.variance === 0 ? "success" : "error",
        text: data.variance === 0 ? `${agent.name}: cash matches.` : `${agent.name}: ${data.variance > 0 ? "over" : "short"} by ${formatXAF(Math.abs(data.variance))}.`,
      });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not save the count.") });
    }
  };

  const totalExpected = agents.reduce((sum, a) => sum + a.expected, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Cash"
        title="Daily cash reconciliation"
        description="Cash sold at each counter, less cash refunded, is the amount every agent should hand over. Record what you actually count."
        actions={<input type="date" aria-label="Date" className="input h-10 w-auto" value={date} max={todayInCameroon()} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      />

      {message && (
        <div className={`alert mb-5 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
          {message.text}
        </div>
      )}
      {result?.error && (
        <div className="alert alert-error mb-5" role="alert">
          {result.error}
        </div>
      )}

      <div className="mb-6 card p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cash expected on {formatDate(date)}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{formatXAF(totalExpected)}</p>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Tickets</th>
                <th className="px-5 py-3 text-right">Sales</th>
                <th className="px-5 py-3 text-right">Refunds</th>
                <th className="px-5 py-3 text-right">Expected</th>
                <th className="px-5 py-3">Counted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    {loading ? "Loading..." : "No counter sales on this day."}
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{agent.name}</td>
                    <td className="px-5 py-3.5 text-slate-700">{agent.tickets}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{formatXAF(agent.sales)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{formatXAF(agent.refunds)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatXAF(agent.expected)}</td>
                    <td className="px-5 py-3.5">
                      {agent.handover ? (
                        <div>
                          <p className="font-semibold text-slate-900">{formatXAF(agent.handover.counted)}</p>
                          <p className={`text-xs font-semibold ${agent.handover.variance === 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {agent.handover.variance === 0
                              ? "Matches"
                              : `${agent.handover.variance > 0 ? "Over" : "Short"} by ${formatXAF(Math.abs(agent.handover.variance))}`}
                          </p>
                          {agent.handover.note && <p className="text-xs text-slate-500">{agent.handover.note}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            aria-label={`Cash counted for ${agent.name}`}
                            className="input h-9 w-28"
                            value={counts[agent.agentId] ?? ""}
                            onChange={(e) => setCounts((prev) => ({ ...prev, [agent.agentId]: e.target.value }))}
                          />
                          <input
                            aria-label={`Note for ${agent.name}`}
                            placeholder="Note"
                            className="input hidden h-9 w-32 lg:block"
                            value={notes[agent.agentId] ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [agent.agentId]: e.target.value }))}
                          />
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => save(agent)}>
                            Save
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface Mine {
  date: string;
  bookings: number;
  tickets: number;
  sales: number;
  refunds: number;
  expected: number;
}

interface MyTicket {
  id: number | string;
  booking_ref: string;
  status: string;
  total_amount_fcfa: number;
  created_at: string;
  origin_city: string;
  destination_city: string;
  travel_date: string;
  departure_time: string;
}

function MyCash() {
  const [result, setResult] = useState<{ summary: Mine | null; list: MyTicket[]; error: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get("/admin/cash/mine")
      .then(({ data }) => active && setResult({ summary: data, list: data.tickets ?? [], error: "" }))
      .catch((err) => active && setResult({ summary: null, list: [], error: errorMessage(err, "We could not load your cash summary.") }));
    return () => {
      active = false;
    };
  }, []);

  const summary = result?.summary;
  const cards = [
    { label: "Tickets sold today", value: String(summary?.tickets ?? 0) },
    { label: "Cash taken", value: formatXAF(summary?.sales) },
    { label: "Cash refunded", value: formatXAF(summary?.refunds) },
    { label: "Cash to hand over", value: formatXAF(summary?.expected) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Cash" title="My cash today" description="Hand over the amount shown at the end of your shift. Your manager records the count." />

      {result?.error && (
        <div className="alert alert-error mb-5" role="alert">
          {result.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{result ? card.value : <span className="skeleton inline-block h-7 w-24 rounded" />}</p>
          </div>
        ))}
      </div>

      <section className="card mt-8 overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-900">Tickets sold today</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {(result?.list ?? []).length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-slate-500">{result ? "No tickets sold yet today." : "Loading..."}</li>
          ) : (
            result?.list.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-900">{t.booking_ref}</p>
                  <p className="text-slate-600">
                    {t.origin_city} to {t.destination_city}, {formatDate(t.travel_date)} {formatTime(t.departure_time)}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(t.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-slate-900">{formatXAF(t.total_amount_fcfa)}</p>
                  <StatusBadge status={t.status} />
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

export default function CashPage() {
  const user = useUser();
  if (user === undefined) return <div className="skeleton h-64 rounded-xl" />;
  return isAdmin(user) ? <AdminCash /> : <MyCash />;
}