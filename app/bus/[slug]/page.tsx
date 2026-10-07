import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { brand } from "@/config/brand";
import { fetchPublic } from "@/lib/server";
import { formatDate, formatTime, formatXAF, todayInCameroon } from "@/lib/format";
import type { RoutePage, Trip } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

const loadRoute = (slug: string) =>
  fetchPublic<{ route: RoutePage; trips: Trip[] }>(`/route-pages/${encodeURIComponent(slug)}`, 600);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadRoute(slug);
  if (!data) return { title: "Route not found", robots: { index: false } };

  const { route } = data;
  const title = `${route.fromCity} to ${route.toCity} bus: tickets, times and fares`;
  const description = `Book ${route.fromCity} to ${route.toCity} bus tickets online with ${brand.name}. ${
    route.minPrice ? `Fares from ${formatXAF(route.minPrice)}. ` : ""
  }Choose your seat, pay with Mobile Money and travel with a verified e-ticket.`;

  return {
    title,
    description,
    alternates: { canonical: `/bus/${slug}` },
    openGraph: { title, description, url: `/bus/${slug}` },
  };
}

export default async function RoutePageView({ params }: Params) {
  const { slug } = await params;
  const [data, all] = await Promise.all([
    loadRoute(slug),
    fetchPublic<{ routes: RoutePage[] }>("/route-pages", 600),
  ]);
  if (!data) notFound();

  const { route, trips } = data;
  const related = (all?.routes ?? [])
    .filter((r) => r.slug !== route.slug && (r.fromCity === route.fromCity || r.toCity === route.toCity))
    .slice(0, 8);

  const searchHref = `/dashboard?from=${route.fromParkId}&to=${route.toParkId}&date=${todayInCameroon()}`;

  const faqs = [
    {
      q: `How much is a bus ticket from ${route.fromCity} to ${route.toCity}?`,
      a: route.minPrice
        ? `Fares start from ${formatXAF(route.minPrice)} per seat. The exact price is shown on each departure before you pay, together with the terminal, service and Mobile Money fees.`
        : `The fare is shown on each departure before you pay, together with the terminal, service and Mobile Money fees.`,
    },
    {
      q: `Where does the ${route.fromCity} to ${route.toCity} bus leave from?`,
      a: `Buses leave from ${route.fromParks.join(" or ")} in ${route.fromCity} and arrive at ${route.toParks.join(" or ")} in ${route.toCity}. The terminal is shown on every departure.`,
    },
    {
      q: "How do I pay?",
      a: `Pay with ${brand.payments} directly from your phone. Your seat is confirmed as soon as the payment is received.`,
    },
    {
      q: "What do I need to travel?",
      a: `Bring your e-ticket (on your phone or printed) and the identity document used at booking. Arrive ${brand.boardingMinutes} minutes before departure.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: brand.siteUrl },
          { "@type": "ListItem", position: 2, name: "Routes", item: `${brand.siteUrl}/bus` },
          { "@type": "ListItem", position: 3, name: `${route.fromCity} to ${route.toCity}`, item: `${brand.siteUrl}/bus/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />

        <section className="border-b border-accent/30 bg-primary text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
              <Link href="/" className="hover:text-white">Home</Link> /{" "}
              <Link href="/bus" className="hover:text-white">Routes</Link>
            </nav>
            <h1 className="mt-4 max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">
              {route.fromCity} to {route.toCity} bus
            </h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Reserve your seat on the {route.fromCity} to {route.toCity} bus, pay with Mobile Money and travel with a
              verified e-ticket.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href={searchHref} className="btn btn-accent">Search departures</Link>
              {route.minPrice ? (
                <p className="text-sm text-slate-300">
                  Fares from <strong className="text-white">{formatXAF(route.minPrice)}</strong>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="eyebrow">Next departures</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {route.fromCity} to {route.toCity}
          </h2>

          {trips.length === 0 ? (
            <div className="card mt-6 p-8 text-center">
              <p className="font-semibold text-slate-900">No departures are on sale right now.</p>
              <p className="mt-2 text-sm text-slate-600">
                New departures are published regularly. Call {brand.support.phone} for the latest schedule.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <article key={trip.id} className="card flex flex-col p-6">
                  <p className="text-xs font-semibold text-slate-500">{formatDate(trip.travelDate)}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{formatTime(trip.departureTime)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {trip.fromParkName} to {trip.toParkName}
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4">
                    <div>
                      <p className="text-lg font-extrabold text-primary">{formatXAF(trip.price)}</p>
                      <p className={`text-xs font-semibold ${trip.availableSeats <= 5 ? "text-red-600" : "text-slate-500"}`}>
                        {trip.availableSeats} seats left
                      </p>
                    </div>
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

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="eyebrow">About this route</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Travelling from {route.fromCity} to {route.toCity}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {brand.name} runs scheduled intercity buses between {route.fromCity} and {route.toCity}. Buses leave from{" "}
                {route.fromParks.join(" or ")} and arrive at {route.toParks.join(" or ")}. Every passenger is registered with
                an identity document and every ticket carries a QR code that is checked at boarding and at checkpoints.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Frequently asked questions</h2>
              <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
                {faqs.map((faq) => (
                  <details key={faq.q} className="group p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">{faq.q}</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-lg font-bold text-slate-900">Other routes</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/bus/${r.slug}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
                >
                  {r.fromCity} to {r.toCity}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}