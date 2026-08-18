"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import {
  saveSettings, setVendorRate, setPieceRate, createSite, createLocality, createRewardTier,
  createSupplierType, deleteSupplierType, createExpenseCategory, deleteExpenseCategory,
  type FormState,
} from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type NamedItem = { id: string; name: string };

export function SupplierTypeManager({ items }: { items: NamedItem[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSupplierType, {});
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-2">
        {items.map((t) => (
          <li key={t.id} className="flex items-center gap-1.5 rounded-full bg-muted-bg px-3 py-1 text-sm">
            {t.name}
            <form action={deleteSupplierType.bind(null, t.id)}>
              <button type="submit" aria-label={`Delete ${t.name}`} className="cursor-pointer text-muted hover:text-destructive">
                <X size={13} />
              </button>
            </form>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">No supplier types yet.</li>}
      </ul>
      <form action={action} className="flex items-end gap-2">
        <div className="flex-1">
          <label className={labelClass}>New supplier type</label>
          <input name="name" required placeholder="e.g. Scrap dealer" className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add"}</button>
      </form>
      {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

export function ExpenseCategoryManager({ items }: { items: NamedItem[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createExpenseCategory, {});
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5 rounded-full bg-muted-bg px-3 py-1 text-sm">
            {c.name}
            <form action={deleteExpenseCategory.bind(null, c.id)}>
              <button type="submit" aria-label={`Delete ${c.name}`} className="cursor-pointer text-muted hover:text-destructive">
                <X size={13} />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action} className="flex items-end gap-2">
        <div className="flex-1">
          <label className={labelClass}>New expense category</label>
          <input name="name" required placeholder="e.g. Security" className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add"}</button>
      </form>
      {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      <p className="mt-1 text-xs text-muted">Categories with recorded expenses are kept for history and can&apos;t be deleted.</p>
    </div>
  );
}

type Option = { id: string; name: string };

export function GeneralSettingsForm({
  values,
}: {
  values: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSettings, {});
  const fields = [
    { key: "collection.min_pickup_kg", label: "Minimum pickup request (kg)" },
    { key: "collection.tolerance_pct", label: "Collection variance tolerance (%)" },
    { key: "production.tolerance_pct", label: "Production discrepancy tolerance (%)" },
    { key: "payout.sla_hours", label: "Vendor payout SLA (hours)" },
    { key: "payroll.advance_cap_pct", label: "Max advance deduction per week (% of wage)" },
    { key: "wallet.min_withdrawal", label: "Minimum vendor withdrawal (₦)" },
    { key: "wallet.instant_limit", label: "Instant payout limit per withdrawal (₦)" },
    { key: "wallet.instant_daily_cap", label: "Instant payout daily cap per vendor (₦)" },
  ];
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className={labelClass}>{f.label}</label>
          <input
            id={f.key} name={f.key} type="number" min="0" step="0.5"
            defaultValue={values[f.key]} className={inputClass}
          />
        </div>
      ))}
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-accent sm:col-span-2">{state.ok}</p>}
    </form>
  );
}

export function VendorRateForm({ materials }: { materials: Option[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setVendorRate, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-36 flex-1">
        <label htmlFor="vr-mat" className={labelClass}>Material</label>
        <select id="vr-mat" name="materialTypeId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="vr-price" className={labelClass}>New price (₦/kg)</label>
        <input id="vr-price" name="pricePerKg" type="number" min="0.01" step="0.01" required className={`${inputClass} w-32`} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Set rate"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function PieceRateForm({
  stages,
  materials,
}: {
  stages: Option[];
  materials: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setPieceRate, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-32 flex-1">
        <label htmlFor="pc-stage" className={labelClass}>Stage</label>
        <select id="pc-stage" name="stageId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="min-w-32 flex-1">
        <label htmlFor="pc-mat" className={labelClass}>Material</label>
        <select id="pc-mat" name="materialTypeId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select —</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="pc-rate" className={labelClass}>Rate (₦/kg output)</label>
        <input id="pc-rate" name="ratePerKg" type="number" min="0.01" step="0.01" required className={`${inputClass} w-32`} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Set rate"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function SiteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSite, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1">
        <label htmlFor="site-name" className={labelClass}>New site name</label>
        <input id="site-name" name="name" required placeholder="e.g. Zyntomax Abuja" className={inputClass} />
      </div>
      <div>
        <label htmlFor="site-kind" className={labelClass}>Type</label>
        <select id="site-kind" name="kind" className={inputClass} defaultValue="FACTORY">
          <option value="FACTORY">Factory</option>
          <option value="COLLECTION_HUB">Collection hub</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Add site"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function LocalityForm({ sites }: { sites: Option[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLocality, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="loc-site" className={labelClass}>Site</label>
        <select id="loc-site" name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="min-w-40 flex-1">
        <label htmlFor="loc-name" className={labelClass}>New locality</label>
        <input id="loc-name" name="name" required placeholder="e.g. Mushin" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add locality"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function RewardTierForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRewardTier, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="rt-name" className={labelClass}>Tier name</label>
        <input id="rt-name" name="name" required placeholder="Bronze" className={`${inputClass} w-28`} />
      </div>
      <div>
        <label htmlFor="rt-threshold" className={labelClass}>Threshold (kg)</label>
        <input id="rt-threshold" name="thresholdKg" type="number" min="1" required className={`${inputClass} w-28`} />
      </div>
      <div className="min-w-40 flex-1">
        <label htmlFor="rt-reward" className={labelClass}>Reward</label>
        <input id="rt-reward" name="reward" required placeholder="Foodstuff pack" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add tier"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
