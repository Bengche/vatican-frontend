"use client";

import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";

interface Device {
  id: string;
  label: string;
  kind: "scanner" | "counter";
  created_at: string;
  last_seen_at: string | null;
  last_sync_at: string | null;
  revoked_at: string | null;
  selling_since: string | null;
  lease_until: string | null;
  clock_offset_ms: string | number | null;
  pending_items: number | null;
  park_city: string | null;
  park_name: string | null;
  user_name: string;
  user_role: string;
}

const DAY_MS = 86_400_000;
const PAUSE_MS = 14 * 3_600_000;

/** A device that has not reported in for a day, or never did: it may be lost, broken or switched off. */
const isStale = (device: Device, now: number) => {
  if (device.revoked_at) return false;
  const last = device.last_sync_at ?? device.last_seen_at ?? device.created_at;
  return now - new Date(last).getTime() > DAY_MS;
};

const driftMinutes = (device: Device) => Math.round(Math.abs(Number(device.clock_offset_ms ?? 0)) / 60_000);

/** A counter that was selling and has stopped reporting in: online booking for its terminal is paused. */
const isPaused = (device: Device, now: number) => {
  if (device.kind !== "counter" || device.revoked_at || !device.selling_since || !device.lease_until) return false;
  const quietFor = now - new Date(device.lease_until).getTime();
  return quietFor > 0 && quietFor < PAUSE_MS;
};

function syncState(device: Device) {
  if (device.revoked_at) return { text: "Disabled", tone: "bg-slate-100 text-slate-600" };
  if (!device.last_sync_at) return { text: "Never synced", tone: "bg-amber-50 text-amber-800" };
  const age = Date.now() - new Date(device.last_sync_at).getTime();
  return age > DAY_MS
    ? { text: `No sync for ${Math.floor(age / DAY_MS)} day(s)`, tone: "bg-red-50 text-red-700" }
    : { text: "Synced recently", tone: "bg-emerald-50 text-emerald-700" };
}

export default function DevicesPage() {
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ key: number; rows: Device[]; error: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get("/admin/devices")
      .then(({ data }) => {
        if (!active) return;
        setNow(Date.now());
        setResult({ key: reload, rows: data.devices ?? [], error: "" });
      })
      .catch((err) => active && setResult({ key: reload, rows: [], error: errorMessage(err, "We could not load devices.") }));
    return () => {
      active = false;
    };
  }, [reload]);

  const rows = result?.rows ?? [];
  const loading = result?.key !== reload;
  const staleCount = rows.filter((d) => isStale(d, now)).length;

  const revoke = async (device: Device) => {
    if (!window.confirm(`Disable "${device.label}"? It will stop syncing and its offline data is removed the next time it connects.`)) return;
    setMessage(null);
    try {
      await api.post(`/admin/devices/${device.id}/revoke`);
      setMessage({ type: "success", text: "Device disabled." });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not disable this device.") });
    }
  };

  const reopen = async (device: Device) => {
    setMessage(null);
    try {
      await api.post(`/admin/devices/${device.id}/end-session`);
      setMessage({ type: "success", text: "Online booking reopened for this terminal." });
      setReload((n) => n + 1);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "We could not reopen online booking.") });
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Devices"
        title="Offline devices"
        description="Phones and laptops set up to scan tickets with no internet. Disable a device that is lost or stolen, and watch for devices that have not synced."
      />

      {message && (
        <div className={`alert mb-5 ${message.type === "error" ? "alert-error" : "alert-success"}`} role="alert">
          {message.text}
        </div>
      )}
      {result?.error && (
        <div className="alert alert-error mb-5" role="alert">
          {result.error}
        </div>
      )}
      {staleCount > 0 && (
        <div className="alert alert-error mb-5" role="alert">
          {staleCount} device(s) have not reported in for over a day. Check that they are not lost, broken or switched off, and ask the staff to open the app with a connection.
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Device</th>
                <th className="px-5 py-3">Used by</th>
                <th className="px-5 py-3">Last sync</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No devices yet. A staff member sets one up from the Boarding page.
                  </td>
                </tr>
              ) : (
                rows.map((device) => {
                  const state = syncState(device);
                  const paused = isPaused(device, now);
                  return (
                    <tr key={device.id}>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {device.label}
                        <span className="block text-xs font-normal text-slate-500">
                          {device.kind === "counter" ? `Counter${device.park_city ? `, ${device.park_city}` : ""}` : "Boarding scanner"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {device.user_name}
                        <span className="block text-xs text-slate-500">{ROLE_LABELS[device.user_role] ?? device.user_role}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {device.last_sync_at ? formatDateTime(device.last_sync_at) : "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${state.tone}`}>{state.text}</span>
                        {paused && (
                          <span className="mt-1 block text-[11px] font-semibold text-amber-800">
                            Offline mid-shift: online booking is paused for this terminal.
                          </span>
                        )}
                        {isStale(device, now) && (
                          <span className="mt-1 block text-[11px] font-semibold text-red-700">Has not reported in for over a day.</span>
                        )}
                        {!device.revoked_at && (device.pending_items ?? 0) > 0 && (
                          <span className="mt-1 block text-[11px] font-semibold text-amber-800">{device.pending_items} item(s) waiting to upload on the device.</span>
                        )}
                        {!device.revoked_at && driftMinutes(device) >= 2 && (
                          <span className="mt-1 block text-[11px] font-semibold text-amber-800">Clock is about {driftMinutes(device)} min off.</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {paused && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => reopen(device)}>
                            Reopen online booking
                          </button>
                        )}
                        {!device.revoked_at && (
                          <button type="button" className="btn btn-ghost btn-sm text-red-700" onClick={() => revoke(device)}>
                            Disable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
