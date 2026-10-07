"use client";

import type { PassengerInput } from "@/lib/types";

interface Props {
  index: number;
  total: number;
  seatLabel: string;
  value: PassengerInput;
  onChange: (value: PassengerInput) => void;
  /** Counter tickets use the shorter age-optional wording. */
  idHint?: string;
}

export default function PassengerFields({
  index,
  total,
  seatLabel,
  value,
  onChange,
  idHint,
}: Props) {
  const id = `passenger-${index}`;
  const set = (patch: Partial<PassengerInput>) =>
    onChange({ ...value, ...patch });

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <legend className="flex items-center gap-2 px-2 text-sm font-bold text-slate-900">
        {total > 1 ? `Passenger ${index + 1}` : "Passenger"}
        <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
          Seat {seatLabel}
        </span>
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-name`} className="label">
            Full name (as on ID)
          </label>
          <input
            id={`${id}-name`}
            className="input uppercase placeholder:normal-case"
            autoComplete={index === 0 ? "name" : "off"}
            placeholder="e.g. JEAN PAUL MBARGA"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${id}-idcard`} className="label">
            ID document number
          </label>
          <input
            id={`${id}-idcard`}
            className="input font-mono uppercase placeholder:font-sans placeholder:normal-case"
            autoComplete="off"
            placeholder={idHint ?? "National ID, passport or student ID"}
            value={value.idCardNumber}
            onChange={(e) => set({ idCardNumber: e.target.value })}
            required
          />
        </div>

        <div>
          <label htmlFor={`${id}-age`} className="label">
            Age
          </label>
          <input
            id={`${id}-age`}
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={119}
            value={value.age}
            onChange={(e) => set({ age: e.target.value })}
            required
          />
        </div>

        <div>
          <label htmlFor={`${id}-gender`} className="label">
            Gender
          </label>
          <select
            id={`${id}-gender`}
            className="input"
            value={value.gender}
            onChange={(e) =>
              set({ gender: e.target.value as PassengerInput["gender"] })
            }
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}
