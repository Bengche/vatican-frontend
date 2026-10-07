"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "../components/AuthShell";
import { api, errorMessage } from "@/lib/api";
import { setSession } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const registered = params.get("registered") === "true";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Enter your phone number or email and your password.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/login", { identifier: identifier.trim(), password });
      setSession(data.token, data.user);
      const redirect = params.get("redirect");
      router.replace(redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard");
    } catch (err) {
      setError(errorMessage(err, "We could not sign you in. Please try again."));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {registered && <div className="alert alert-success">Your account is ready. Sign in to continue.</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div>
        <label htmlFor="identifier" className="label">Phone number or email</label>
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

      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input
            id="password"
            className="input pr-16"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to book seats and access your tickets.">
      <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
