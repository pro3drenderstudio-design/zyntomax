"use client";

import { useActionState } from "react";
import { setBudget, setTarget, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export function BudgetForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setBudget, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1">
        <label htmlFor="b-cat" className={labelClass}>Category</label>
        <select id="b-cat" name="categoryId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="b-period" className={labelClass}>Month</label>
        <input id="b-period" name="period" type="month" defaultValue={currentPeriod()} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="b-amount" className={labelClass}>Budget (₦)</label>
        <input id="b-amount" name="amount" type="number" min="1" step="0.01" required className={`${inputClass} w-36`} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Set budget"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function TargetForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setTarget, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-44 flex-1">
        <label htmlFor="t-metric" className={labelClass}>Metric</label>
        <select id="t-metric" name="metric" required className={inputClass} defaultValue="FINISHED_OUTPUT_KG">
          <option value="FINISHED_OUTPUT_KG">Finished output (kg)</option>
          <option value="COLLECTION_KG">Collection (kg)</option>
          <option value="PURCHASE_KG">Purchases (kg)</option>
          <option value="SALES_NAIRA">Sales (₦)</option>
        </select>
      </div>
      <div>
        <label htmlFor="t-period" className={labelClass}>Month</label>
        <input id="t-period" name="period" type="month" defaultValue={currentPeriod()} required className={inputClass} />
      </div>
      <div>
        <label htmlFor="t-value" className={labelClass}>Target</label>
        <input id="t-value" name="value" type="number" min="1" step="1" required className={`${inputClass} w-36`} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Set target"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
