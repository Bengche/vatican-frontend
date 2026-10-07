"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatXAF } from "@/lib/format";

interface Payout {
  id: number | string;
  kind: string;
  amount_fcfa: number;
  phone: string | null;
  status: string;
  error: string | null;
  reason: string | null;
  attempts: number;
  created_at: string;
  booking_ref: string | null;
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
];

const KIND_LABEL: Record<string, string> = {
  agency: "Agency revenue",
  platform: "Platform fee",
  refund: "Refund",
};

export default function PayoutsPage() {
  const [status, setStatus] = useState("failed");
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<{ key: string; rows: Payout[]; error: string } | null>(null);

  const key = `${status}|${reload}`;
  const loading = result?.key !== key;

  useEffect(() => {
    let active = true;
    api
      .get("/admin/payouts", { params: { status } })
      .then(({ data }) => active && setResult({ key, rows: data.payouts ?? [], error: "" }))
      .catch((err) => active && setResult({ key, rows: [], error: errorMessage(err, "We could not load payouts.") }));
    return () => {
      active = false;
    };
  }, [key, status]);

  const rows = result?.rows ?? [];

  const retry = async (payout: Payout) => {
    setBusyId(payout.id);
    setMessage(null);
    try {
      const { data } = await api.post(`/admin/payouts/${payout.id}/retry`);
      setMessage({ type: data.status === "sent" ? "success" : "error", text: data.message });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not retry this payout.") });
    } finally {
      setBusyId(null);
    }
  };

  const settle = async (payout: Payout) => {
    const note = window.prompt("Add a short note (for example: paid manually by Mobile Money)", "");
    if (note === null) return;
    setBusyId(payout.id);
    try {
      await api.post(`/admin/payouts/${payout.id}/dismiss`, { note });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not update this payout.") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Payouts"
        title="Money sent out"
        description="Every transfer the system makes: agency revenue, platform fees and passenger refunds. A failed payout is never lost; retry it here once the cause is fixed."
        actions={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatus(item.key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${status === item.key ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
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

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Booking</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    {loading ? "Loading..." : status === "failed" ? "No failed payouts. Everything went through." : "Nothing to show."}
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{formatDateTime(p.created_at)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{p.booking_ref ?? "-"}</td>
                    <td className="px-5 py-3.5 text-slate-700">{p.phone ?? "Cash at counter"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatXAF(p.amount_fcfa)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                      {p.error && <p className="mt-1 max-w-56 text-xs text-red-600">{p.error}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {["failed", "pending", "processing"].includes(p.status) && (
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={busyId === p.id} onClick={() => retry(p)} className="btn btn-outline btn-sm">
                            Retry
                          </button>
                          {p.status === "failed" && (
                            <button type="button" disabled={busyId === p.id} onClick={() => settle(p)} className="btn btn-ghost btn-sm">
                              Mark settled
                            </button>
                          )}
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