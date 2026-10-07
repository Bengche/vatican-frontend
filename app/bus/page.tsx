import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { brand } from "@/config/brand";
import { fetchPublic } from "@/lib/server";
import { formatXAF } from "@/lib/format";
import type { RoutePage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Bus routes and fares across Cameroon",
  description: `Every intercity route served by ${brand.name}, with fares and departure terminals. Book your seat online and pay with Mobile Money.`,
  alternates: { canonical: "/bus" },
};

export default async function RoutesIndexPage() {
  const data = await fetchPublic<{ routes: RoutePage[] }>("/route-pages", 600);
  const routes = data?.routes ?? [];

  const byOrigin = new Map<string, RoutePage[]>();
  for (const route of routes) {
    byOrigin.set(route.fromCity, [...(byOrigin.get(route.fromCity) ?? []), route]);
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-accent/30 bg-primary text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Routes</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-tight sm:text-5xl">
              Bus routes across Cameroon
            </h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Pick your route to see fares, departure terminals and the next buses.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {routes.length === 0 ? (
            <p className="text-sm text-slate-600">Routes will appear here soon.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...byOrigin.entries()].map(([city, list]) => (
                <div key={city} className="card p-6">
                  <h2 className="text-base font-bold text-slate-900">From {city}</h2>
                  <ul className="mt-4 divide-y divide-slate-100">
                    {list.map((route) => (
                      <li key={route.slug}>
                        <Link
                          href={`/bus/${route.slug}`}
                          className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                        >
                          <span className="font-medium text-slate-800">
                            {route.fromCity} to {route.toCity}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-slate-500">
                            {route.minPrice ? `from ${formatXAF(route.minPrice)}` : "View"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}