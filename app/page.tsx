import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import TripSearchForm from "./components/TripSearchForm";
import RouteMotif from "./components/RouteMotif";
import { brand } from "@/config/brand";
import { fetchPublic } from "@/lib/server";
import { formatDate, formatTime, formatXAF } from "@/lib/format";
import type { Park, RoutePage, Trip } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} | ${brand.seo.title}` },
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    title: "Search your route",
    text: "Choose your terminals and travel date to see every available departure with live seat counts.",
  },
  {
    title: "Pick your seat",
    text: "Select your exact seat on the bus and enter each passenger's details as shown on their ID.",
  },
  {
    title: "Pay with Mobile Money",
    text: `Approve the prompt on your phone. We accept ${brand.payments}.`,
  },
  {
    title: "Travel with your e-ticket",
    text: "Your ticket arrives by email as a PDF with a QR code that is verified at boarding and checkpoints.",
  },
];

const FEATURES = [
  {
    title: "Reserved seating",
    text: "Know your seat before you travel. No rushing, no standing in the queue.",
  },
  {
    title: "Secure payment",
    text: "Pay safely from your phone. Your seat is only confirmed once payment is received.",
  },
  {
    title: "Verified e-ticket",
    text: "Every ticket carries a unique QR code that checkpoints and agents can verify instantly.",
  },
  {
    title: "Instant confirmation",
    text: "Receipt and ticket are emailed the moment your payment clears.",
  },
];

export default async function HomePage() {
  const [parksData, tripsData, routesData] = await Promise.all([
    fetchPublic<{ parks: Park[] }>("/parks", 300),
    fetchPublic<{ trips: Trip[] }>("/trips/upcoming?limit=6", 60),
    fetchPublic<{ routes: RoutePage[] }>("/route-pages", 600),
  ]);
  const parks = parksData?.parks ?? [];
  const trips = tripsData?.trips ?? [];
  const routes = (routesData?.routes ?? []).slice(0, 12);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: brand.name,
    legalName: brand.legalName,
    url: brand.siteUrl,
    telephone: brand.support.phoneHref,
    email: brand.support.email,
    description: brand.seo.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: brand.headOffice,
      addressCountry: "CM",
    },
  };

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-accent/30 bg-primary text-white">
          <RouteMotif className="absolute bottom-40 right-0 top-8 hidden w-[44%] lg:block" />
          <div className="relative mx-auto max-w-7xl px-4 pb-32 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-40 lg:pt-24">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{brand.hero.eyebrow}</p>
              <h1 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-[3.75rem]">
                {brand.hero.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                {brand.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
                {[
                  "Choose your own seat",
                  "Pay with Mobile Money",
                  "Ticket delivered by email",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-accent"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="relative z-10 mx-auto -mt-24 max-w-7xl px-4 sm:px-6 lg:-mt-28 lg:px-8">
          <div className="card p-5 sm:p-7">
            <h2 className="mb-5 text-lg font-bold text-slate-900">
              Where are you travelling?
            </h2>
            <TripSearchForm parks={parks} />
          </div>
        </section>

        {/* Departures */}
        <section
          id="departures"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Upcoming departures</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Next buses on sale
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Search all routes &rarr;
            </Link>
          </div>

          {trips.length === 0 ? (
            <div className="card mt-8 p-8 text-center sm:p-12">
              <p className="text-base font-semibold text-slate-900">
                New departures are published daily.
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Use the search above to check a specific route and date, or
                contact our team for the latest schedule.
              </p>
              <a
                href={`tel:${brand.support.phoneHref}`}
                className="btn btn-outline mt-6"
              >
                Call {brand.support.phone}
              </a>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <article key={trip.id} className="card flex flex-col p-6">
                  <p className="text-xs font-semibold text-slate-500">
                    {formatDate(trip.travelDate)}
                  </p>
                  <h3 className="font-display mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    {trip.fromCity} <span className="text-accent">&rarr;</span>{" "}
                    {trip.toCity}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {trip.fromParkName} to {trip.toParkName}
                  </p>

                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-dashed border-slate-200 pt-4 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Departs
                      </dt>
                      <dd className="mt-1 font-bold text-slate-900">
                        {formatTime(trip.departureTime)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Class
                      </dt>
                      <dd className="mt-1 truncate font-bold text-slate-900">
                        {trip.busType || "Standard"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Seats left
                      </dt>
                      <dd
                        className={`mt-1 font-bold ${trip.availableSeats <= 5 ? "text-red-600" : "text-slate-900"}`}
                      >
                        {trip.availableSeats}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-primary">
                      {formatXAF(trip.price)}
                    </p>
                    <Link
                      href={`/dashboard?from=${trip.fromParkId}&to=${trip.toParkId}&date=${trip.travelDate}`}
                      className="btn btn-primary btn-sm"
                    >
                      Select seats
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {routes.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">Popular routes</h2>
              <Link href="/bus" className="text-sm font-semibold text-primary hover:underline">
                All routes &rarr;
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {routes.map((route) => (
                <Link
                  key={route.slug}
                  href={`/bus/${route.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                >
                  {route.fromCity} to {route.toCity}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section
          id="how"
          className="border-y border-slate-200 bg-white py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                From booking to boarding in four steps
              </h2>
            </div>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="border-l-2 border-accent pl-4"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {feature.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Boarding requirements */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow">Before you travel</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Passenger identification
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                In line with national transport regulations, every passenger is
                registered on the manifest with a valid identity document. Names
                on tickets must match the document presented at boarding.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
              {[
                {
                  title: "Register your ID",
                  text: "National ID card, passport or student ID number is required for every passenger.",
                },
                {
                  title: `Arrive ${brand.boardingMinutes} minutes early`,
                  text: "Report to your departure terminal ahead of time with your ticket and ID.",
                },
                {
                  title: "Show your QR code",
                  text: "Present your e-ticket on your phone or printed. It is verified at the terminal and at checkpoints.",
                },
              ].map((item) => (
                <div key={item.title} className="card p-5">
                  <h3 className="text-sm font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Terminals */}
        <section
          id="terminals"
          className="border-t border-slate-200 bg-white py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="eyebrow">Our terminals</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Find us in every major city
              </h2>
              <p className="mt-3 text-sm text-slate-600">
                Tickets can also be bought and verified in person at any
                terminal counter.
              </p>
            </div>

            {parks.length === 0 ? (
              <p className="mt-8 text-sm text-slate-500">
                Terminal details are temporarily unavailable. Please call{" "}
                {brand.support.phone}.
              </p>
            ) : (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {parks.map((park) => (
                  <div
                    key={park.id}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-accent-dark">
                      {park.city}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      {park.name}
                    </h3>
                    {park.address && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {park.address}
                      </p>
                    )}
                    <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {brand.support.hours}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
