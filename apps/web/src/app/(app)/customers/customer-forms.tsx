"use client";

import { useActionState } from "react";
import { createCustomer, setListPrice, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export function CustomerForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createCustomer,
    {},
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="c-name" className={labelClass}>Company name *</label>
        <input id="c-name" name="name" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="c-contact" className={labelClass}>Contact person</label>
        <input id="c-contact" name="contactName" className={inputClass} />
      </div>
      <div>
        <label htmlFor="c-phone" className={labelClass}>Phone</label>
        <input id="c-phone" name="phone" type="tel" className={inputClass} />
      </div>
      <div>
        <label htmlFor="c-email" className={labelClass}>Email</label>
        <input id="c-email" name="email" type="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="c-terms" className={labelClass}>Credit terms (days)</label>
        <input id="c-terms" name="creditTermsDays" type="number" min="0" max="120" defaultValue={0} className={inputClass} />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add customer"}
        </button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{state.error}</p>}
    </form>
  );
}

export function PriceForm({
  products,
}: {
  products: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setListPrice,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1">
        <label htmlFor="pr-product" className="mb-0.5 block text-xs text-muted">Product</label>
        <select id="pr-product" name="productId" required className={`${inputClass} py-1.5`} defaultValue="">
          <option value="" disabled>— Select —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="pr-price" className="mb-0.5 block text-xs text-muted">New list price (₦/kg)</label>
        <input id="pr-price" name="pricePerKg" type="number" min="0.01" step="0.01" required className={`${inputClass} w-36 py-1.5`} />
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Saving…" : "Set price"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
