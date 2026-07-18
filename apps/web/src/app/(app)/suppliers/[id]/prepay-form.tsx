"use client";

import { useActionState } from "react";
import { addPrepayment, type FormState } from "../actions";
import { inputClass, buttonClass } from "@/components/ui";

export function PrepayForm({ supplierId }: { supplierId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPrepayment, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="supplierId" value={supplierId} />
      <div>
        <label className="mb-0.5 block text-xs text-muted">Advance amount (₦)</label>
        <input name="amount" type="number" min="1" step="0.01" required className={`${inputClass} w-36`} />
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-muted">Method</label>
        <select name="method" className={`${inputClass} w-32`} defaultValue="TRANSFER">
          <option value="TRANSFER">Transfer</option>
          <option value="CASH">Cash</option>
          <option value="PAYSTACK">Paystack</option>
        </select>
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-muted">Reference</label>
        <input name="reference" className={`${inputClass} w-36`} />
      </div>
      <div className="min-w-32 flex-1">
        <label className="mb-0.5 block text-xs text-muted">Note</label>
        <input name="note" placeholder="e.g. advance for June PET" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Recording…" : "Record advance"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-accent">{state.ok}</p>}
    </form>
  );
}
