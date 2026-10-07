import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "../components/Logo";
import RetryButton from "./RetryButton";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-primary px-6 text-center text-white">
      <BrandMark size={72} />
      <h1 className="mt-8 text-3xl font-medium tracking-[-0.015em] sm:text-4xl">
        You are offline
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
        {brand.name} needs an internet connection to search buses and take
        payments. Tickets you have already opened stay available on this device.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <RetryButton />
        <Link
          href="/my-bookings"
          className="btn border border-white/20 text-white hover:bg-white/10"
        >
          My saved tickets
        </Link>
      </div>
    </main>
  );
}
