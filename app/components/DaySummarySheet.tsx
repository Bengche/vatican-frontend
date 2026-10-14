"use client";

import { brand } from "@/config/brand";
import { formatXAF } from "@/lib/format";
import type { DaySummary } from "@/lib/offline/summary";

/** The end-of-day sheet a clerk prints or shows when handing over cash. */
export default function DaySummarySheet({
  summary,
  agent,
  terminal,
}: {
  summary: DaySummary;
  agent: string;
  terminal: string | null;
}) {
  return (
    <div className="w-full bg-white p-6 text-slate-900">
      <h1 className="text-xl font-extrabold">{brand.name}: counter summary</h1>
      <p className="mt-1 text-sm">
        {summary.day} | {agent}
        {terminal ? ` | ${terminal}` : ""}
      </p>

      <div className="mt-4 grid max-w-md gap-1 text-sm">
        <div className="flex justify-between"><span>Tickets sold</span><strong>{summary.tickets}</strong></div>
        <div className="flex justify-between"><span>Cash to hand over ({summary.cashSales} sales)</span><strong>{formatXAF(summary.cashAmount)}</strong></div>
        <div className="flex justify-between"><span>Mobile Money, to verify ({summary.momoSales} sales)</span><strong>{formatXAF(summary.momoAmount)}</strong></div>
        {summary.paperEntries > 0 && <div className="flex justify-between"><span>Paper tickets entered</span><strong>{summary.paperEntries}</strong></div>}
        {summary.waiting > 0 && <div className="flex justify-between"><span>Not yet uploaded</span><strong>{summary.waiting}</strong></div>}
        {summary.needAttention > 0 && <div className="flex justify-between"><span>Needing a manager</span><strong>{summary.needAttention}</strong></div>}
      </div>

      <table className="mt-5 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-1.5 pr-2">Ticket</th>
            <th className="py-1.5 pr-2">Passengers</th>
            <th className="py-1.5 pr-2">Paid by</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {summary.lines.map((line) => (
            <tr key={line.ref} className="border-b border-slate-300">
              <td className="py-1.5 pr-2 font-mono">{line.ref}</td>
              <td className="py-1.5 pr-2 uppercase">{line.names}</td>
              <td className="py-1.5 pr-2">{line.method === "momo" ? "Mobile Money" : "Cash"}</td>
              <td className="py-1.5 text-right font-semibold">{formatXAF(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-slate-600">Counted by: ________________ Received by: ________________</p>
    </div>
  );
}
