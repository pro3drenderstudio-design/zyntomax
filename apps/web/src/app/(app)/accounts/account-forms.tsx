"use client";

import { useActionState } from "react";
import { createCashAccount, fundAccount, spendFromAccount, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function CreateAccountForm({ sites }: { sites: Option[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCashAccount, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <label className={labelClass}>Account name</label>
        <input name="name" required placeholder="e.g. Factory expenses" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Site</label>
        <select name="siteId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Creating…" : "Create account"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function FundForm({ accountId }: { accountId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(fundAccount, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <div>
        <label className={labelClass}>Add funds (₦)</label>
        <input name="amount" type="number" min="0.01" step="0.01" required className={`${inputClass} w-36`} />
      </div>
      <div className="min-w-32 flex-1">
        <label className={labelClass}>Note</label>
        <input name="note" placeholder="e.g. Monthly float" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "…" : "Fund"}</button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function SpendForm({ accountId, categories }: { accountId: string; categories: Option[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(spendFromAccount, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <div>
        <label className={labelClass}>Spend (₦)</label>
        <input name="amount" type="number" min="0.01" step="0.01" required className={`${inputClass} w-32`} />
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <select name="categoryId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Date</label>
        <input name="date" type="date" defaultValue={today} className={inputClass} />
      </div>
      <div className="min-w-32 flex-1">
        <label className={labelClass}>Description</label>
        <input name="description" placeholder="e.g. Welding repairs" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "…" : "Record spend"}</button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
