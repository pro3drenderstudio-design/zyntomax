"use client";

import { useActionState } from "react";
import { createSupplier, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export function SupplierForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createSupplier,
    {},
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="s-name" className={labelClass}>Name *</label>
        <input id="s-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="s-kind" className={labelClass}>Type *</label>
        <select id="s-kind" name="kind" required className={inputClass} defaultValue="INDEPENDENT_COLLECTOR">
          <option value="INDEPENDENT_COLLECTOR">Independent collector</option>
          <option value="DUMPSITE">Dumpsite aggregator</option>
          <option value="RESELLER">Reseller</option>
        </select>
      </div>
      <div>
        <label htmlFor="s-phone" className={labelClass}>Phone</label>
        <input id="s-phone" name="phone" type="tel" className={inputClass} />
      </div>
      <div>
        <label htmlFor="s-notes" className={labelClass}>Notes</label>
        <input id="s-notes" name="notes" className={inputClass} />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add supplier"}
        </button>
      </div>
    </form>
  );
}
