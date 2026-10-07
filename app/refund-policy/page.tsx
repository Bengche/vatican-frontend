import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "../components/LegalPage";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description: `How cancellations and refunds work at ${brand.name}.`,
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  const { fullRefundHours, partialRefundHours, partialPercent } =
    brand.refundPolicy;

  const rows = [
    {
      when: `${fullRefundHours} hours or more before departure`,
      refund: "100% of the ticket price",
    },
    {
      when: `Between ${partialRefundHours} and ${fullRefundHours} hours before departure`,
      refund: `${partialPercent}% of the ticket price`,
    },
    {
      when: `Less than ${partialRefundHours} hours before departure, or after departure`,
      refund: "No refund",
    },
  ];

  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund and cancellation policy"
      intro="We want cancellations to be simple and fair. This page explains when you are refunded, how much and how quickly."
    >
      <LegalSection title="1. If you cancel">
        <p>The refund depends on how long before the departure time you ask us to cancel:</p>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">When you cancel</th>
                <th className="px-4 py-3">You receive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.when}>
                  <td className="px-4 py-3 text-slate-700">{row.when}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.refund}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The ticket price means the base fare of the seats you cancelled. The
          terminal fee, service fee and Mobile Money network fee are not
          refundable. A passenger who does not show up for the departure is not
          refunded.
        </p>
      </LegalSection>

      <LegalSection title="2. If we cancel">
        <p>
          If we cancel a departure or cannot carry you, you receive a full refund
          of everything you paid, including all fees, and we will tell you by
          email.
        </p>
      </LegalSection>

      <LegalSection title="3. If your payment arrives too late">
        <p>
          A seat is held for a few minutes while you pay. If your payment reaches
          us after the hold expired and the seat has been taken by someone else,
          we refund the full amount automatically to the same Mobile Money number
          and email you.
        </p>
      </LegalSection>

      <LegalSection title="4. How to ask for a cancellation">
        <ul>
          <li>
            Call {brand.support.phone} ({brand.support.hours}) or write to{" "}
            <a href={`mailto:${brand.support.email}`} className="font-semibold text-primary hover:underline">
              {brand.support.email}
            </a>{" "}
            with your booking reference.
          </li>
          <li>Our team confirms the refund amount, cancels the ticket and releases the seat.</li>
          <li>The cancelled ticket stops being valid immediately.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. How you are paid">
        <ul>
          <li>
            Tickets paid with Mobile Money are refunded to the Mobile Money
            number used for the payment, usually within a few working days.
          </li>
          <li>Tickets bought in cash at a terminal counter are refunded in cash at that counter.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. More information">
        <p>
          See our{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            terms of service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}