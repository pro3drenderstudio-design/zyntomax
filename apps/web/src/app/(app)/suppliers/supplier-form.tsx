"use client";

import { useActionState } from "react";
import { createSupplier, updateSupplier, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export type SupplierEditData = {
  id: string;
  name: string;
  typeId: string | null;
  phone: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  notes: string | null;
};

export function SupplierForm({
  types,
  supplier,
  onedit,
}: {
  types: { id: string; name: string }[];
  supplier?: SupplierEditData;
  onedit?: boolean;
}) {
  const isEdit = !!supplier;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateSupplier : createSupplier,
    {},
  );
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      {isEdit && <input type="hidden" name="id" value={supplier.id} />}
      <div>
        <label className={labelClass}>Name *</label>
        <input name="name" required defaultValue={supplier?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Type</label>
        <select name="typeId" defaultValue={supplier?.typeId ?? ""} className={inputClass}>
          <option value="">— Select —</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input name="phone" type="tel" defaultValue={supplier?.phone ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Contact person</label>
        <input name="contactPerson" defaultValue={supplier?.contactPerson ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Contact phone</label>
        <input name="contactPhone" type="tel" defaultValue={supplier?.contactPhone ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <input name="address" defaultValue={supplier?.address ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Bank</label>
        <input name="bankName" defaultValue={supplier?.bankName ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Account number</label>
        <input name="bankAccountNo" inputMode="numeric" defaultValue={supplier?.bankAccountNo ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <input name="notes" defaultValue={supplier?.notes ?? ""} className={inputClass} />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{state.error}</p>}
      {state.ok && !onedit && <p className="text-sm text-accent sm:col-span-3">{state.ok}</p>}
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add supplier"}
        </button>
      </div>
    </form>
  );
}
