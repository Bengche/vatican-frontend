"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";

interface Member {
  id: number | string;
  full_name: string;
  phone_number: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const EMPTY = { fullName: "", phoneNumber: "", email: "", role: "counter_agent", password: "" };

export default function StaffPage() {
  const user = useUser();
  const isSuper = user?.role === "super_admin";
  const [form, setForm] = useState(EMPTY);
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<{ key: number; rows: Member[]; error: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get("/admin/staff")
      .then(({ data }) => active && setResult({ key: reload, rows: data.staff ?? [], error: "" }))
      .catch((err) => active && setResult({ key: reload, rows: [], error: errorMessage(err, "We could not load staff accounts.") }));
    return () => {
      active = false;
    };
  }, [reload]);

  const rows = result?.rows ?? [];
  const loading = result?.key !== reload;

  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await api.post("/admin/staff", form);
      setMessage({ type: "success", text: "Account created. Share the phone number and password with the staff member." });
      setForm(EMPTY);
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not create this account.") });
    } finally {
      setSubmitting(false);
    }
  };

  const patch = async (member: Member, body: Record<string, unknown>, success: string) => {
    setMessage(null);
    try {
      await api.patch(`/admin/staff/${member.id}`, body);
      setMessage({ type: "success", text: success });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not update this account.") });
    }
  };

  const resetPassword = (member: Member) => {
    const password = window.prompt(`New password for ${member.full_name} (at least 8 characters)`);
    if (password) void patch(member, { password }, "Password changed.");
  };

  const canManage = (member: Member) =>
    String(member.id) !== String(user?.id) && (isSuper || !["agency_admin", "super_admin"].includes(member.role));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Staff"
        title="Staff accounts"
        description="Counter agents sell tickets and hold the cash. Boarding agents check passengers in. Administrators manage everything."
      />

      {message && (
        <div className={`alert mb-5 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
          {message.text}
        </div>
      )}

      <section className="card mb-8 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Add a staff member</h2>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="fullName" className="label">Full name</label>
            <input id="fullName" name="fullName" className="input" value={form.fullName} onChange={update} required />
          </div>
          <div>
            <label htmlFor="phoneNumber" className="label">Phone number</label>
            <input id="phoneNumber" name="phoneNumber" className="input" inputMode="tel" placeholder="6XX XXX XXX" value={form.phoneNumber} onChange={update} required />
          </div>
          <div>
            <label htmlFor="email" className="label">Email (optional)</label>
            <input id="email" name="email" type="email" className="input" value={form.email} onChange={update} />
          </div>
          <div>
            <label htmlFor="role" className="label">Role</label>
            <select id="role" name="role" className="input" value={form.role} onChange={update}>
              <option value="counter_agent">Counter agent</option>
              <option value="gateman">Boarding agent</option>
              {isSuper && <option value="agency_admin">Administrator</option>}
            </select>
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="text" autoComplete="off" className="input" placeholder="At least 8 characters" value={form.password} onChange={update} required />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      </section>

      {result?.error && (
        <div className="alert alert-error mb-5" role="alert">
          {result.error}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    {loading ? "Loading..." : "No staff accounts yet."}
                  </td>
                </tr>
              ) : (
                rows.map((member) => (
                  <tr key={member.id} className={member.is_active ? "" : "opacity-60"}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{member.full_name}</p>
                      <p className="text-xs text-slate-500">Since {formatDateTime(member.created_at)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{ROLE_LABELS[member.role] ?? member.role}</td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {member.phone_number}
                      {member.email && <p className="text-xs text-slate-500">{member.email}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${member.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {member.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {canManage(member) && (
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => resetPassword(member)}>
                            New password
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${member.is_active ? "btn-danger" : "btn-outline"}`}
                            onClick={() =>
                              patch(member, { isActive: !member.is_active }, member.is_active ? "Account deactivated." : "Account reactivated.")
                            }
                          >
                            {member.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}