import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          We could not find that page
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600">
          The address may be mistyped or the page may have moved.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="btn btn-primary">
            Go to the home page
          </Link>
          <Link href="/dashboard" className="btn btn-outline">
            Search departures
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}