"use client";

import { useActionState } from "react";
import { createPurchaseBatch, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function PurchaseForm({
  sites,
  suppliers,
}: {
  sites: Option[];
  suppliers: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPurchaseBatch,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm"
    >
      <div>
        <label htmlFor="siteId" className={labelClass}>Destination factory *</label>
        <select id="siteId" name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="supplierId" className={labelClass}>Supplier *</label>
        <select id="supplierId" name="supplierId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">
          Missing supplier? Add them on the Suppliers page first.
        </p>
      </div>
      <div>
        <label htmlFor="fieldEstKg" className={labelClass}>Estimated weight in the field (kg)</label>
        <input id="fieldEstKg" name="fieldEstKg" type="number" step="1" min="0" className={inputClass} />
        <p className="mt-1 text-xs text-muted">
          Compared automatically against the factory scale-in.
        </p>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Create batch"}
      </button>
    </form>
  );
}
