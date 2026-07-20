"use client";

import { useActionState } from "react";
import { logDiesel, logDieselPurchase, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export function DieselPurchaseForm({ sites }: { sites: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(logDieselPurchase, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className={labelClass}>Site</label>
        <select name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Date</label>
        <input name="date" type="date" defaultValue={today} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Litres bought</label>
        <input name="litres" type="number" step="0.1" min="0" required className={`${inputClass} w-28`} />
      </div>
      <div>
        <label className={labelClass}>Total cost (₦)</label>
        <input name="cost" type="number" step="0.01" min="0" className={`${inputClass} w-32`} />
      </div>
      <div className="min-w-32 flex-1">
        <label className={labelClass}>Supplier / note</label>
        <input name="note" placeholder="e.g. Oando station" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Add purchase"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function DieselForm({ sites }: { sites: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(logDiesel, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className={labelClass}>Site</label>
        <select name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Date</label>
        <input name="date" type="date" defaultValue={today} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Litres used</label>
        <input name="litres" type="number" step="0.1" min="0" required className={`${inputClass} w-28`} />
      </div>
      <div className="min-w-32 flex-1">
        <label className={labelClass}>Note</label>
        <input name="note" placeholder="e.g. generator + forklift" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Logging…" : "Log usage"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
