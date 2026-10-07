"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "../components/AuthShell";
import { api, errorMessage } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <div className="space-y-5">
        <div className="alert alert-error" role="alert">
          This reset link is not valid. Please request a new one.
        </div>
        <Link href="/forgot-password" className="btn btn-primary w-full">
          Request a new link
        </Link>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");

    setSubmitting(true);
    setError("");
    try {
      await api.post("/reset-password", { token, password });
      router.replace("/login?reset=true");
    } catch (err) {
      setError(errorMessage(err, "We could not change your password. Please request a new link."));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            className="input pr-16"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirm new password
        </label>
        <input
          id="confirm"
          className="input"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
        {submitting ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Pick a password you have not used elsewhere.">
      <Suspense fallback={<div className="skeleton h-64 rounded-xl" />}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}