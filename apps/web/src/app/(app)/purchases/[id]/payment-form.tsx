"use client";

import { useActionState } from "react";
import { addSupplierPayment, type FormState } from "../actions";
import { inputClass, buttonClass } from "@/components/ui";

export function PaymentForm({ batchId }: { batchId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addSupplierPayment,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="batchId" value={batchId} />
      <div>
        <label htmlFor="p-amount" className="mb-1 block text-xs font-medium text-muted">
          Amount (₦)
        </label>
        <input
          id="p-amount" name="amount" type="number" min="1" step="0.01" required
          className={`${inputClass} w-32`}
        />
      </div>
      <div>
        <label htmlFor="p-method" className="mb-1 block text-xs font-medium text-muted">
          Method
        </label>
        <select id="p-method" name="method" className={`${inputClass} w-32`} defaultValue="TRANSFER">
          <option value="TRANSFER">Transfer</option>
          <option value="CASH">Cash</option>
          <option value="PAYSTACK">Paystack</option>
        </select>
      </div>
      <div>
        <label htmlFor="p-ref" className="mb-1 block text-xs font-medium text-muted">
          Reference
        </label>
        <input id="p-ref" name="reference" className={`${inputClass} w-36`} />
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 pb-2 text-sm">
        <input type="checkbox" name="isAdvance" className="accent-[#059669]" />
        Advance
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Recording…" : "Record payment"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
