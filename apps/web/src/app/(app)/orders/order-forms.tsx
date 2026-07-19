"use client";

import { useActionState, useState } from "react";
import { recordSale, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass, secondaryButtonClass } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; name: string };
export type SellableOption = { ref: string; name: string; availableKg: number; price: number; color: string | null };
type Line = { key: number; kind: "inventory" | "other"; itemRef: string; description: string; qtyKg: string; unitPrice: string };

let counter = 0;
const newLine = (): Line => ({ key: counter++, kind: "inventory", itemRef: "", description: "", qtyKg: "", unitPrice: "" });

export function SaleForm({
  customers,
  sites,
  items,
}: {
  customers: Option[];
  sites: Option[];
  items: SellableOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordSale, {});
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const itemOf = (ref: string) => items.find((i) => i.ref === ref);
  const total = lines.reduce((s, l) => {
    const qty = Number(l.qtyKg) || (l.kind === "other" ? 1 : 0);
    return s + qty * (Number(l.unitPrice) || 0);
  }, 0);

  const noStock = items.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Customer *</label>
          <select name="customerId" required className={inputClass} defaultValue="">
            <option value="" disabled>— Select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Site *</label>
          <select name="siteId" required className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((l) => {
          const sel = itemOf(l.itemRef);
          const overMax = sel && Number(l.qtyKg) > sel.availableKg;
          return (
            <div key={l.key} className="rounded-md border border-border p-2.5">
              <input type="hidden" name="kind" value={l.kind} />
              <div className="mb-2 flex gap-1">
                {(["inventory", "other"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => update(l.key, { kind: k })}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium ${l.kind === k ? "bg-accent-soft text-accent" : "bg-muted-bg text-muted"}`}
                  >
                    {k === "inventory" ? "From inventory" : "Other / non-inventory"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {l.kind === "inventory" ? (
                  <>
                    <div className="min-w-48 flex-1">
                      <label className="mb-0.5 block text-xs text-muted">Item (available stock)</label>
                      <select
                        name="itemRef" value={l.itemRef}
                        onChange={(e) => {
                          const it = itemOf(e.target.value);
                          update(l.key, { itemRef: e.target.value, unitPrice: l.unitPrice || (it && it.price > 0 ? String(it.price) : "") });
                        }}
                        className={`${inputClass} py-1.5`}
                        disabled={noStock}
                      >
                        <option value="">{noStock ? "Nothing in stock" : "— Select —"}</option>
                        {items.map((it) => (
                          <option key={it.ref} value={it.ref}>
                            {it.name} — {it.availableKg.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg
                          </option>
                        ))}
                      </select>
                    </div>
                    <input type="hidden" name="description" value="" />
                    <div>
                      <label className="mb-0.5 block text-xs text-muted">
                        Qty (kg){sel ? ` · max ${sel.availableKg.toLocaleString("en-NG", { maximumFractionDigits: 1 })}` : ""}
                      </label>
                      <input
                        name="qtyKg" type="number" step="0.1" min="0" max={sel?.availableKg}
                        value={l.qtyKg} onChange={(e) => update(l.key, { qtyKg: e.target.value })}
                        className={`${inputClass} w-32 py-1.5 ${overMax ? "border-destructive" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-muted">Price ₦/kg</label>
                      <input name="unitPrice" type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={`${inputClass} w-28 py-1.5`} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-40 flex-1">
                      <label className="mb-0.5 block text-xs text-muted">Description</label>
                      <input name="description" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="e.g. Mixed scrap, delivery fee" className={`${inputClass} py-1.5`} />
                    </div>
                    <input type="hidden" name="itemRef" value="" />
                    <input type="hidden" name="qtyKg" value="1" />
                    <div>
                      <label className="mb-0.5 block text-xs text-muted">Amount (₦)</label>
                      <input name="unitPrice" type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={`${inputClass} w-32 py-1.5`} />
                    </div>
                  </>
                )}
                {lines.length > 1 && (
                  <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="cursor-pointer rounded-md p-2 text-muted hover:bg-destructive-soft hover:text-destructive">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {overMax && <p className="mt-1 text-xs text-destructive">Only {sel!.availableKg.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg available.</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}>
          <Plus size={14} aria-hidden /> Add line
        </button>
        <p className="tabular text-lg font-semibold">Total: ₦{total.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" name="markPaid" className="accent-[#008037]" /> Mark as paid now (cash sale)
      </label>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? "Recording…" : "Record sale"}
      </button>
      <p className="text-xs text-muted">Only items with available stock are listed; quantities are capped at what&apos;s in the finished-goods store.</p>
    </form>
  );
}
