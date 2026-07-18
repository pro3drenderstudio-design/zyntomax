"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createPurchaseBatch, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass, secondaryButtonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function PurchaseForm({
  sites,
  suppliers,
  supplierTypes,
}: {
  sites: Option[];
  suppliers: Option[];
  supplierTypes: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPurchaseBatch,
    {},
  );
  const [list, setList] = useState(suppliers);
  const [selected, setSelected] = useState("");
  const [showModal, setShowModal] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm"
    >
      <div>
        <label htmlFor="siteId" className={labelClass}>Destination factory *</label>
        <select id="siteId" name="siteId" required className={inputClass}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="supplierId" className={labelClass}>Supplier *</label>
        <div className="flex gap-2">
          <select
            id="supplierId" name="supplierId" required value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>— Select supplier —</option>
            {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={`${secondaryButtonClass} inline-flex shrink-0 items-center gap-1`}
          >
            <Plus size={15} aria-hidden /> New
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="fieldEstKg" className={labelClass}>Estimated weight in the field (kg)</label>
        <input id="fieldEstKg" name="fieldEstKg" type="number" step="1" min="0" className={inputClass} />
        <p className="mt-1 text-xs text-muted">Compared automatically against the factory scale-in.</p>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Create batch"}
      </button>

      {showModal && (
        <NewSupplierModal
          types={supplierTypes}
          onClose={() => setShowModal(false)}
          onCreated={(s) => {
            setList((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
            setSelected(s.id);
            setShowModal(false);
          }}
        />
      )}
    </form>
  );
}

function NewSupplierModal({
  types,
  onClose,
  onCreated,
}: {
  types: Option[];
  onClose: () => void;
  onCreated: (s: Option) => void;
}) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/suppliers/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, typeId, phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      onCreated({ id: body.id, name: body.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add supplier");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">New supplier</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
              <option value="">— Select —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={inputClass} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || name.trim().length < 2} className={buttonClass}>
              {busy ? "Adding…" : "Add & select"}
            </button>
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
