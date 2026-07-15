"use client";

import { useActionState } from "react";
import { createExpense, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function ExpenseForm({
  sites,
  categories,
  batches,
  trips,
}: {
  sites: Option[];
  categories: Option[];
  batches: Option[];
  trips: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createExpense,
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="e-site" className={labelClass}>Site *</label>
        <select id="e-site" name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="e-cat" className={labelClass}>Category *</label>
        <select id="e-cat" name="categoryId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="e-amount" className={labelClass}>Amount (₦) *</label>
        <input id="e-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="e-date" className={labelClass}>Date</label>
        <input id="e-date" name="incurredAt" type="date" className={inputClass} />
      </div>
      <div>
        <label htmlFor="e-batch" className={labelClass}>Tie to purchase batch</label>
        <select id="e-batch" name="purchaseBatchId" className={inputClass} defaultValue="">
          <option value="">— None —</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="e-trip" className={labelClass}>Tie to collection trip</label>
        <select id="e-trip" name="tripId" className={inputClass} defaultValue="">
          <option value="">— None —</option>
          {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="e-desc" className={labelClass}>Description</label>
        <input id="e-desc" name="description" placeholder="e.g. Logistics for Olusosun run" className={inputClass} />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Recording…" : "Record expense"}
        </button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{state.error}</p>}
    </form>
  );
}
