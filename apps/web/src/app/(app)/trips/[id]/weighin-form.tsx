"use client";

import { useActionState } from "react";
import { addWeighIn, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function WeighInForm({
  tripId,
  vendors,
  materials,
}: {
  tripId: string;
  vendors: Option[];
  materials: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addWeighIn,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <div className="min-w-44 flex-1">
        <label htmlFor="vendorId" className={labelClass}>Vendor</label>
        <select id="vendorId" name="vendorId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="min-w-36 flex-1">
        <label htmlFor="materialTypeId" className={labelClass}>Material</label>
        <select id="materialTypeId" name="materialTypeId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="w-28">
        <label htmlFor="weightKg" className={labelClass}>Weight (kg)</label>
        <input
          id="weightKg" name="weightKg" type="number" step="0.1" min="0.1"
          required className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Record weigh-in"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
