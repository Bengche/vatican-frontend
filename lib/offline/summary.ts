import type { CounterSale } from "./counterDb";

export interface DaySummary {
  day: string;
  tickets: number;
  cashSales: number;
  cashAmount: number;
  momoSales: number;
  momoAmount: number;
  paperEntries: number;
  waiting: number;
  needAttention: number;
  lines: { ref: string; names: string; amount: number; method: "cash" | "momo"; state: CounterSale["state"] }[];
}

/**
 * What a clerk hands over at the end of the day, worked out from the sales on the phone.
 * Sales the server refused are left out: no ticket was issued for them.
 */
export function summarize(sales: CounterSale[], day: string, dayOf: (ms: number) => string): DaySummary {
  const today = sales.filter((s) => dayOf(Date.parse(s.soldAt)) === day);
  const counted = today.filter((s) => s.state !== "rejected");
  const cash = counted.filter((s) => s.payment.method === "cash");
  const momo = counted.filter((s) => s.payment.method === "momo");
  const sum = (list: CounterSale[]) => list.reduce((total, s) => total + s.amount, 0);

  return {
    day,
    tickets: counted.reduce((total, s) => total + s.passengers.length, 0),
    cashSales: cash.length,
    cashAmount: sum(cash),
    momoSales: momo.length,
    momoAmount: sum(momo),
    paperEntries: counted.filter((s) => s.lateEntry).length,
    waiting: counted.filter((s) => s.state === "pending").length,
    needAttention: today.filter((s) => s.state === "flagged" || s.state === "rejected").length,
    lines: [...counted]
      .sort((a, b) => a.soldAt.localeCompare(b.soldAt))
      .map((s) => ({
        ref: s.ref,
        names: s.passengers.map((p) => p.name).join(", "),
        amount: s.amount,
        method: s.payment.method,
        state: s.state,
      })),
  };
}

const xaf = (n: number) => `${n.toLocaleString("en-GB")} XAF`;

/** Plain text version for sharing by message. */
export function summaryText(summary: DaySummary, agent: string, terminal: string | null) {
  return [
    `Counter summary ${summary.day}`,
    `${agent}${terminal ? `, ${terminal}` : ""}`,
    `Tickets sold: ${summary.tickets}`,
    `Cash to hand over: ${xaf(summary.cashAmount)} (${summary.cashSales} sales)`,
    `Mobile Money: ${xaf(summary.momoAmount)} (${summary.momoSales} sales, to be verified)`,
    summary.paperEntries ? `Paper tickets entered: ${summary.paperEntries}` : "",
    summary.waiting ? `Not yet uploaded: ${summary.waiting}` : "",
    summary.needAttention ? `Needing a manager: ${summary.needAttention}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
