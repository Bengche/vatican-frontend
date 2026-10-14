"use client";

const LIMIT_MS = 2 * 60_000;

/** Warns when the phone's clock is clearly wrong; ticket times and "today" depend on it. */
export default function ClockWarning({ offsetMs }: { offsetMs: number }) {
  if (Math.abs(offsetMs) < LIMIT_MS) return null;
  const minutes = Math.round(Math.abs(offsetMs) / 60_000);
  const amount = minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`;
  return (
    <div className="alert alert-error mb-4" role="alert">
      This phone&apos;s clock is about {amount} {offsetMs > 0 ? "behind" : "ahead of"} the real time. While you have
      internet the correct time is used, but fix the date and time in your phone settings so tickets are always right.
    </div>
  );
}
