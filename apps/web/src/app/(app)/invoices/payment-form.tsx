"use client";

import { useActionState } from "react";
import { recordCustomerPayment, type FormState } from "../orders/actions";
import { inputClass, buttonClass } from "@/components/ui";

export function InvoicePaymentForm({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    recordCustomerPayment,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input
        name="amount" type="number" min="1" step="0.01" required
        placeholder="₦ amount" aria-label="Payment amount"
        className={`${inputClass} w-28 py-1`}
      />
      <select name="method" aria-label="Payment method" className={`${inputClass} w-24 py-1`} defaultValue="TRANSFER">
        <option value="TRANSFER">Transfer</option>
        <option value="CASH">Cash</option>
        <option value="PAYSTACK">Paystack</option>
      </select>
      <input
        name="reference" placeholder="Ref" aria-label="Payment reference"
        className={`${inputClass} w-24 py-1`}
      />
      <button type="submit" disabled={pending} className={`${buttonClass} px-2.5 py-1 text-xs`}>
        {pending ? "…" : "Record"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
