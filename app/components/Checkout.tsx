"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PassengerFields from "./PassengerFields";
import { brand } from "@/config/brand";
import { api, errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { downloadTicket } from "@/lib/download";
import {
  formatDate,
  formatTime,
  formatXAF,
  toNationalPhone,
} from "@/lib/format";
import type { PassengerInput, Quote, Seat, Trip } from "@/lib/types";

interface Props {
  trip: Trip;
  seats: Seat[];
  onBack: () => void;
  onReset: () => void;
}

type Step = "form" | "paying" | "success" | "failed";

interface ActiveBooking {
  id: string | number;
  booking_ref: string;
  total_amount_fcfa: number;
}

export default function Checkout({ trip, seats, onBack, onReset }: Props) {
  const user = getUser();
  const [passengers, setPassengers] = useState<PassengerInput[]>(() =>
    seats.map((seat, index) => ({
      seatId: seat.id,
      name: index === 0 ? (user?.name ?? "").toUpperCase() : "",
      idCardNumber: "",
      age: "",
      gender: "male",
    })),
  );
  const [payerPhone, setPayerPhone] = useState(user?.phone_number ?? "");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookingRef = useRef<ActiveBooking | null>(null);
  const deadlineRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get(`/trips/${trip.id}/quote`, { params: { seats: seats.length } })
      .then(({ data }) => active && setQuote(data.quote))
      .catch(() => active && setQuote(null));
    return () => {
      active = false;
    };
  }, [trip.id, seats.length]);

  useEffect(() => stopPolling, [stopPolling]);

  const releaseHold = useCallback(async () => {
    const current = bookingRef.current;
    if (!current) return;
    bookingRef.current = null;
    await api.post(`/bookings/${current.id}/cancel`).catch(() => {});
  }, []);

  // Hold countdown while the passenger approves the payment on their phone.
  useEffect(() => {
    if (step !== "paying") return;
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        stopPolling();
        setError(
          "The payment window has expired and your seats were released. Please try again.",
        );
        setStep("failed");
        releaseHold();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [step, stopPolling, releaseHold]);

  const startPolling = (bookingId: string | number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${bookingId}`);
        if (
          data.bookingStatus === "confirmed" ||
          data.paymentStatus === "SUCCESS"
        ) {
          stopPolling();
          bookingRef.current = null;
          setStep("success");
        } else if (
          data.bookingStatus === "cancelled" ||
          data.paymentStatus === "FAILED"
        ) {
          stopPolling();
          setError(
            "The payment was declined or cancelled on your phone. You have not been charged.",
          );
          setStep("failed");
        }
      } catch {
        // Temporary network errors: keep polling until the window closes.
      }
    }, 3000);
  };

  const validate = (): string => {
    for (const [index, p] of passengers.entries()) {
      const who = passengers.length > 1 ? ` for passenger ${index + 1}` : "";
      if (p.name.trim().length < 3)
        return `Enter the full name as shown on the ID${who}.`;
      if (p.idCardNumber.trim().length < 5)
        return `Enter a valid ID document number${who}.`;
      const age = Number.parseInt(p.age, 10);
      if (!Number.isInteger(age) || age < 1 || age > 119)
        return `Enter a valid age${who}.`;
    }
    if (!toNationalPhone(payerPhone))
      return "Enter the Mobile Money number to charge (9 digits starting with 6).";
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
      return "Enter a valid email address for your ticket.";
    return "";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setError("");
    setStep("paying");
    setSecondsLeft(300);
    deadlineRef.current = Date.now() + 300_000;

    try {
      const phone = toNationalPhone(payerPhone) as string;
      const { data } = await api.post("/bookings", {
        tripId: trip.id,
        passengers: passengers.map((p) => ({
          seatId: p.seatId,
          name: p.name.trim(),
          idCardNumber: p.idCardNumber.trim(),
          age: Number.parseInt(p.age, 10),
          gender: p.gender,
        })),
        payerPhone: phone,
        contactEmail: contactEmail.trim(),
      });

      const created: ActiveBooking = data.booking;
      setBooking(created);
      bookingRef.current = created;
      setSecondsLeft(data.booking.holdSeconds ?? 300);
      deadlineRef.current =
        Date.now() + (data.booking.holdSeconds ?? 300) * 1000;

      await api.post("/payments/request-payment", {
        bookingId: created.id,
        phone,
      });
      startPolling(created.id);
    } catch (err) {
      stopPolling();
      await releaseHold();
      setError(
        errorMessage(err, "We could not start your payment. Please try again."),
      );
      setStep("failed");
    }
  };

  const cancelPayment = async () => {
    stopPolling();
    await releaseHold();
    setError("");
    setStep("form");
  };

  const download = async () => {
    if (!booking) return;
    setDownloading(true);
    try {
      await downloadTicket(booking.id, booking.booking_ref);
    } catch (err) {
      setError(
        errorMessage(
          err,
          "We could not download the ticket. You can also find it in My tickets.",
        ),
      );
    } finally {
      setDownloading(false);
    }
  };

  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const total = quote?.totalAmount ?? booking?.total_amount_fcfa;
  const seatLabels = seats.map((s) => s.seatLabel).join(", ");

  if (step === "paying") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center sm:p-10">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-accent/50" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </svg>
          </span>
        </div>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">
          Approve the payment on your phone
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
          A payment request for{" "}
          <strong className="text-slate-900">{formatXAF(total)}</strong> was
          sent to <strong className="text-slate-900">{payerPhone}</strong>.
          Enter your Mobile Money PIN to confirm.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-slate-500">
          No prompt? Dial *126# (MTN) or #150# (Orange) to approve the pending
          request.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
          Seats held for{" "}
          <span className="font-bold tabular-nums text-slate-900">{timer}</span>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={cancelPayment}
            className="text-sm font-medium text-slate-500 underline hover:text-slate-900"
          >
            Cancel and change details
          </button>
        </div>
      </div>
    );
  }

  if (step === "success" && booking) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
          <svg
            className="h-8 w-8"
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
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
          Payment confirmed
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">
          Your seats are secured
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {contactEmail
            ? `Your e-ticket was sent to ${contactEmail}.`
            : "Your e-ticket is ready to download."}
        </p>

        <dl className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-left text-sm">
          {[
            [
              "Reference",
              <span key="r" className="font-mono font-bold">
                {booking.booking_ref}
              </span>,
            ],
            ["Route", `${trip.fromCity} to ${trip.toCity}`],
            [
              "Departure",
              `${formatDate(trip.travelDate)}, ${formatTime(trip.departureTime)}`,
            ],
            ["Seats", seatLabels],
            [
              "Total paid",
              <span key="t" className="font-bold text-emerald-700">
                {formatXAF(booking.total_amount_fcfa)}
              </span>,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-4">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-semibold text-slate-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {error && (
          <div className="alert alert-error mt-4 text-left">{error}</div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={download}
            disabled={downloading}
          >
            {downloading ? "Preparing..." : "Download ticket (PDF)"}
          </button>
          <Link href="/my-bookings" className="btn btn-outline">
            View my tickets
          </Link>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 text-sm font-medium text-slate-500 underline hover:text-slate-900"
        >
          Book another trip
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
    >
      <div className="space-y-5">
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {passengers.map((passenger, index) => (
          <PassengerFields
            key={String(passenger.seatId)}
            index={index}
            total={passengers.length}
            seatLabel={seats[index].seatLabel}
            value={passenger}
            onChange={(value) =>
              setPassengers((prev) =>
                prev.map((p, i) => (i === index ? value : p)),
              )
            }
          />
        ))}

        <fieldset className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <legend className="px-2 text-sm font-bold text-slate-900">
            Payment and delivery
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="payer-phone" className="label">
                Mobile Money number
              </label>
              <input
                id="payer-phone"
                type="tel"
                inputMode="numeric"
                className="input"
                placeholder="6XX XXX XXX"
                autoComplete="tel-national"
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="label">
                Email for your e-ticket
              </label>
              <input
                id="contact-email"
                type="email"
                className="input"
                placeholder="name@example.com"
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="card p-5 lg:sticky lg:top-24">
        <h3 className="text-sm font-bold text-slate-900">Trip summary</h3>
        <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {trip.fromCity} <span className="text-accent">&rarr;</span>{" "}
          {trip.toCity}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatDate(trip.travelDate)} at {formatTime(trip.departureTime)}{" "}
          &middot; {trip.busType || "Standard"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Seat{seats.length > 1 ? "s" : ""} {seatLabels}
        </p>

        <dl className="mt-5 space-y-2.5 border-t border-dashed border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">
              Fare ({seats.length} x {formatXAF(trip.price)})
            </dt>
            <dd className="font-semibold">
              {formatXAF(trip.price * seats.length)}
            </dd>
          </div>
          {quote && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Terminal and service fees</dt>
              <dd className="font-semibold">
                {formatXAF(
                  quote.terminalFee + quote.serviceFee + quote.gatewayFee,
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="font-bold text-primary">
              {quote ? formatXAF(quote.totalAmount) : "..."}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <p className="text-xs leading-relaxed text-accent-dark">
            <span className="font-semibold">Mobile Money operator charges.</span>{" "}
            Your operator (MTN or Orange) applies its own transaction charges
            when you approve the payment. These are set by the operator, not by{" "}
            {brand.name}, and are not included in the total above.
          </p>
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-5 w-full"
          disabled={!quote}
        >
          {quote ? `Pay ${formatXAF(quote.totalAmount)}` : "Calculating..."}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-ghost mt-2 w-full"
        >
          Change seats
        </button>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Seats are held for 5 minutes once you start the payment. By paying you
          accept our{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/refund-policy" className="font-semibold text-primary hover:underline">
            Refund policy
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
