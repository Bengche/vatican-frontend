"use client";

export default function RetryButton() {
  return (
    <button
      type="button"
      className="btn btn-accent"
      onClick={() => window.location.reload()}
    >
      Try again
    </button>
  );
}
