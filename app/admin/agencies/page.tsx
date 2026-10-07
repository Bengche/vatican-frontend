"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import { api, errorMessage } from "@/lib/api";
import type { Bus } from "@/lib/types";

interface AdminPark {
  id: number | string;
  city: string;
  park_name: string;
  address_description?: string | null;
  momo_number?: string | null;
}

type Message = { type: "success" | "error"; text: string } | null;

const BUS_TYPES = ["VIP Coaster", "Classic", "Executive"];
const SEAT_LAYOUTS = [
  { value: "2+3", label: "2 + 3: five seats per row" },
  { value: "2+2", label: "2 + 2: four seats per row" },
];

export default function TerminalsPage() {
  const [parks, setParks] = useState<AdminPark[]>([]);
  const [parkId, setParkId] = useState("");
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loadError, setLoadError] = useState("");

  const [momo, setMomo] = useState("");
  const [momoMessage, setMomoMessage] = useState<Message>(null);
  const [savingMomo, setSavingMomo] = useState(false);

  const [busNumber, setBusNumber] = useState("");
  const [busType, setBusType] = useState(BUS_TYPES[0]);
  const [seatLayout, setSeatLayout] = useState(SEAT_LAYOUTS[0].value);
  const [seatCount, setSeatCount] = useState("70");
  const [busMessage, setBusMessage] = useState<Message>(null);
  const [savingBus, setSavingBus] = useState(false);

  const park = parks.find((p) => String(p.id) === parkId) ?? null;

  useEffect(() => {
    api
      .get("/admin/agencies-parks")
      .then(({ data }) => setParks(data.agencyParks ?? []))
      .catch((err) =>
        setLoadError(errorMessage(err, "We could not load the terminals.")),
      );
  }, []);

  const loadBuses = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/admin/parks/${id}/buses`);
      setBuses(data.buses ?? []);
    } catch (err) {
      setLoadError(errorMessage(err, "We could not load the buses."));
    }
  }, []);

  const selectPark = (id: string) => {
    setParkId(id);
    setBusMessage(null);
    setMomoMessage(null);
    setBuses([]);
    const selected = parks.find((p) => String(p.id) === id);
    const number = selected?.momo_number ?? "";
    setMomo(number.startsWith("237") ? number.slice(3) : number);
    if (id) loadBuses(id);
  };

  const saveMomo = async (event: React.FormEvent) => {
    event.preventDefault();
    setMomoMessage(null);
    const digits = momo.replace(/\D/g, "");
    if (!/^6\d{8}$/.test(digits))
      return setMomoMessage({
        type: "error",
        text: "Enter a valid 9-digit number starting with 6.",
      });

    setSavingMomo(true);
    try {
      const { data } = await api.put(`/admin/agencies-parks/${parkId}/momo`, {
        momoNumber: digits,
      });
      setParks((prev) =>
        prev.map((p) =>
          String(p.id) === parkId
            ? { ...p, momo_number: data.agencyPark.momo_number }
            : p,
        ),
      );
      setMomoMessage({
        type: "success",
        text: `Payouts will be sent to +${data.agencyPark.momo_number}.`,
      });
    } catch (err) {
      setMomoMessage({
        type: "error",
        text: errorMessage(err, "We could not save the number."),
      });
    } finally {
      setSavingMomo(false);
    }
  };

  const addBus = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusMessage(null);
    setSavingBus(true);
    try {
      const { data } = await api.post("/admin/buses", {
        parkId,
        busNumber,
        busType,
        seatLayout,
        totalSeats: Number(seatCount),
      });
      setBusMessage({ type: "success", text: data.message });
      setBusNumber("");
      await loadBuses(parkId);
    } catch (err) {
      setBusMessage({
        type: "error",
        text: errorMessage(err, "We could not register this bus."),
      });
    } finally {
      setSavingBus(false);
    }
  };

  const toggleBus = async (bus: Bus) => {
    try {
      await api.patch(`/admin/buses/${bus.id}/status`, {
        isActive: !bus.is_active,
      });
      setBuses((prev) =>
        prev.map((b) =>
          b.id === bus.id ? { ...b, is_active: !bus.is_active } : b,
        ),
      );
    } catch (err) {
      setBusMessage({
        type: "error",
        text: errorMessage(err, "We could not update this bus."),
      });
    }
  };

  const banner = (m: Message) =>
    m && (
      <div
        className={`alert ${m.type === "success" ? "alert-success" : "alert-error"}`}
        role="status"
      >
        {m.text}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Terminals"
        title="Terminals and buses"
        description="Set where each terminal's ticket revenue is paid out and manage the buses stationed there."
      />

      {loadError && (
        <div className="alert alert-error mb-6" role="alert">
          {loadError}
        </div>
      )}

      <div className="card mb-8 p-5">
        <label htmlFor="terminal" className="label">
          Terminal
        </label>
        <select
          id="terminal"
          className="input"
          value={parkId}
          onChange={(e) => selectPark(e.target.value)}
        >
          <option value="">Select a terminal</option>
          {parks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.city} - {p.park_name}
            </option>
          ))}
        </select>
      </div>

      {!park ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          Select a terminal to manage its payout number and buses.
        </div>
      ) : (
        <div className="space-y-8">
          <form
            onSubmit={saveMomo}
            className="card max-w-xl space-y-4 p-5 sm:p-6"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Revenue payout number
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                MTN or Orange Mobile Money number that receives ticket revenue
                for {park.park_name}.
              </p>
            </div>
            {banner(momoMessage)}
            <div>
              <label htmlFor="momo" className="label">
                Mobile Money number
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                  +237
                </span>
                <input
                  id="momo"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  className="input rounded-l-none"
                  placeholder="6XX XXX XXX"
                  value={momo}
                  onChange={(e) => setMomo(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingMomo}
            >
              {savingMomo ? "Saving..." : "Save number"}
            </button>
          </form>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <form onSubmit={addBus} className="card space-y-4 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900">
                Register a bus
              </h2>
              {banner(busMessage)}
              <div>
                <label htmlFor="busNumber" className="label">
                  Registration number
                </label>
                <input
                  id="busNumber"
                  className="input font-mono uppercase placeholder:font-sans placeholder:normal-case"
                  placeholder="e.g. NW 482 AA"
                  value={busNumber}
                  onChange={(e) => setBusNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="busType" className="label">
                  Class
                </label>
                <select
                  id="busType"
                  className="input"
                  value={busType}
                  onChange={(e) => setBusType(e.target.value)}
                >
                  {BUS_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="seats" className="label">
                  Seat capacity
                </label>
                <input
                  id="seats"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={100}
                  className="input"
                  value={seatCount}
                  onChange={(e) => setSeatCount(e.target.value)}
                  required
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Includes the seat beside the driver. Doors and the driver seat
                  are added to the map automatically.
                </p>
              </div>
              <div>
                <label htmlFor="seatLayout" className="label">
                  Seat layout
                </label>
                <select
                  id="seatLayout"
                  className="input"
                  value={seatLayout}
                  onChange={(e) => setSeatLayout(e.target.value)}
                >
                  {SEAT_LAYOUTS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Seats on the left and right of the walkway in each row.
                </p>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={savingBus}
              >
                {savingBus ? "Creating seat map..." : "Register bus"}
              </button>
            </form>

            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <h2 className="text-sm font-bold text-slate-900">
                  Buses at {park.park_name}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {buses.length}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {buses.length === 0 && (
                  <li className="p-8 text-center text-sm text-slate-500">
                    No buses registered for this terminal yet.
                  </li>
                )}
                {buses.map((bus) => (
                  <li
                    key={bus.id}
                    className="flex items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {bus.bus_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {bus.bus_type} &middot; {bus.total_seats} seats &middot;{" "}
                        {bus.seat_layout ?? "2+3"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBus(bus)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${bus.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                    >
                      {bus.is_active ? "Operational" : "Grounded"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
