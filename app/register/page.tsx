"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "../components/AuthShell";
import { api, errorMessage } from "@/lib/api";
import { toNationalPhone } from "@/lib/format";

const EMPTY = {
  fullName: "",
  phoneNumber: "",
  email: "",
  age: "",
  gender: "",
  discussionPreference: "no_preference",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setGlobalError("");
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const age = Number.parseInt(form.age, 10);

    if (form.fullName.trim().length < 3) next.fullName = "Enter your full name.";
    if (!toNationalPhone(form.phoneNumber)) next.phoneNumber = "Enter a valid 9-digit number starting with 6.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address. Your ticket is sent here.";
    if (!Number.isInteger(age) || age < 12 || age > 119) next.age = "Enter a valid age (12 or over).";
    if (!form.gender) next.gender = "Select a gender.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setGlobalError("");
    try {
      await api.post("/register", {
        fullName: form.fullName.trim(),
        phoneNumber: toNationalPhone(form.phoneNumber),
        email: form.email.trim(),
        age: Number.parseInt(form.age, 10),
        gender: form.gender,
        discussionPreference: form.discussionPreference,
        password: form.password,
      });
      router.push("/login?registered=true");
    } catch (err) {
      setGlobalError(errorMessage(err, "We could not create your account. Please try again."));
      setSubmitting(false);
    }
  };

  const error = (name: string) => (errors[name] ? <p className="field-error">{errors[name]}</p> : null);

  return (
    <AuthShell title="Create your account" subtitle="Register once to book tickets and keep all your e-tickets in one place." wide>
      <form onSubmit={submit} noValidate className="space-y-5">
        {globalError && <div className="alert alert-error" role="alert">{globalError}</div>}

        <div>
          <label htmlFor="fullName" className="label">Full name</label>
          <input id="fullName" name="fullName" className="input" autoComplete="name" placeholder="As shown on your ID" value={form.fullName} onChange={update} />
          {error("fullName")}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phoneNumber" className="label">Phone (MTN / Orange)</label>
            <input id="phoneNumber" name="phoneNumber" type="tel" inputMode="numeric" className="input" autoComplete="tel-national" placeholder="6XX XXX XXX" value={form.phoneNumber} onChange={update} />
            {error("phoneNumber")}
          </div>
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" placeholder="name@example.com" value={form.email} onChange={update} />
            {error("email")}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="age" className="label">Age</label>
            <input id="age" name="age" type="number" inputMode="numeric" min={12} max={119} className="input" value={form.age} onChange={update} />
            {error("age")}
          </div>
          <div>
            <label htmlFor="gender" className="label">Gender</label>
            <select id="gender" name="gender" className="input" value={form.gender} onChange={update}>
              <option value="" disabled>Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {error("gender")}
          </div>
        </div>

        <div>
          <label htmlFor="discussionPreference" className="label">Onboard preference</label>
          <select id="discussionPreference" name="discussionPreference" className="input" value={form.discussionPreference} onChange={update}>
            <option value="no_preference">No preference</option>
            <option value="quiet">Quiet journey</option>
            <option value="chatty">Happy to chat</option>
          </select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} className="input pr-16" autoComplete="new-password" value={form.password} onChange={update} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-500 hover:text-slate-900">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {error("password")}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} className="input" autoComplete="new-password" value={form.confirmPassword} onChange={update} />
            {error("confirmPassword")}
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
