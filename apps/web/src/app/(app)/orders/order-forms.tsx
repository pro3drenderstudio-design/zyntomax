"use client";

import { useActionState, useState } from "react";
import { createOrder, createDispatch, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass, secondaryButtonClass } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; name: string };

export function OrderForm({
  customers,
  sites,
  products,
}: {
  customers: Option[];
  sites: Option[];
  products: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createOrder,
    {},
  );
  const [rows, setRows] = useState([0]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="o-customer" className={labelClass}>Customer *</label>
          <select id="o-customer" name="customerId" required className={inputClass} defaultValue="">
            <option value="" disabled>— Select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="o-site" className={labelClass}>Site *</label>
          <select id="o-site" name="siteId" required className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {rows.map((rowId) => (
        <div key={rowId} className="flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass}>Product</label>
            <select name="productId" required className={inputClass} defaultValue="">
              <option value="" disabled>— Select —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Quantity (kg)</label>
            <input name="qtyKg" type="number" step="1" min="1" required className={`${inputClass} w-32`} />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => setRows((r) => r.filter((x) => x !== rowId))}
              className="cursor-pointer rounded-md p-2 text-muted hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}
          className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
        >
          <Plus size={14} aria-hidden /> Add product
        </button>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : "Create order"}
        </button>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <p className="text-xs text-muted">
        Prices are snapshotted from the current price list (customer overrides win).
      </p>
    </form>
  );
}

export function DispatchForm({
  orderId,
  orderProducts,
}: {
  orderId: string;
  orderProducts: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createDispatch,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="d-vehicle" className={labelClass}>Vehicle</label>
          <input id="d-vehicle" name="vehicle" placeholder="Truck ABC-123-XY" className={inputClass} />
        </div>
        <div>
          <label htmlFor="d-driver" className={labelClass}>Driver</label>
          <input id="d-driver" name="driverName" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {orderProducts.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <input type="hidden" name="productId" value={p.id} />
            <span className="w-44 text-sm">{p.name}</span>
            <input
              name="weightKg" type="number" step="0.1" min="0" defaultValue={0}
              aria-label={`Dispatched kg of ${p.name}`}
              className={`${inputClass} w-32`}
            />
            <span className="text-xs text-muted">kg scaled at gate</span>
          </div>
        ))}
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? "Dispatching…" : "Dispatch & generate invoice"}
      </button>
    </form>
  );
}
