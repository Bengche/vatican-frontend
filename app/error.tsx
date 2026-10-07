"use client";

import Link from "next/link";
import Logo from "./components/Logo";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <Logo tone="dark" subtitle="" />
      <h1 className="mt-10 text-2xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        We could not load this page. Please try again, or return to the home page.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-outline">
          Home
        </Link>
      </div>
    </div>
  );
}