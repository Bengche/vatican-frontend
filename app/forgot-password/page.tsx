"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "../components/AuthShell";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim()) {
      setError("Enter the email address or phone number of your account.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/forgot-password", { identifier: identifier.trim() });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, "We could not send the reset link. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address or phone number of your account and we will email you a reset link."
    >
      {sent ? (
        <div className="space-y-5">
          <div className="alert alert-success" role="status">
            If an account matches, a reset link is on its way to the email address
            on file. The link is valid for 60 minutes. Check your spam folder if
            it does not arrive.
          </div>
          <Link href="/login" className="btn btn-primary w-full">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="identifier" className="label">
              Email or phone number
            </label>
            <input
              id="identifier"
              className="input"
              autoComplete="username"
              inputMode="email"
              placeholder="6XX XXX XXX or name@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset link"}
          </button>
          <p className="text-center text-sm text-slate-600">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}