"use client";

import { useActionState } from "react";
import { addIssuance, addStaffLog, addAdvance, type FormState } from "../actions";
import { inputClass, buttonClass } from "@/components/ui";

export function IssuanceForm({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addIssuance, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="staffId" value={staffId} />
      <div className="min-w-40 flex-1">
        <label htmlFor="iss-item" className="mb-0.5 block text-xs text-muted">Item</label>
        <input id="iss-item" name="item" required placeholder="Safety boots, gloves…" className={`${inputClass} py-1.5`} />
      </div>
      <div>
        <label htmlFor="iss-qty" className="mb-0.5 block text-xs text-muted">Qty</label>
        <input id="iss-qty" name="quantity" type="number" min="1" defaultValue={1} className={`${inputClass} w-16 py-1.5`} />
      </div>
      <div>
        <label htmlFor="iss-cond" className="mb-0.5 block text-xs text-muted">Condition</label>
        <select id="iss-cond" name="condition" className={`${inputClass} w-24 py-1.5`} defaultValue="new">
          <option value="new">New</option>
          <option value="used">Used</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Logging…" : "Log issue"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function StaffLogForm({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addStaffLog, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="staffId" value={staffId} />
      <div>
        <label htmlFor="log-kind" className="mb-0.5 block text-xs text-muted">Type</label>
        <select id="log-kind" name="kind" className={`${inputClass} w-32 py-1.5`} defaultValue="MEDICAL">
          <option value="MEDICAL">Medical</option>
          <option value="REWARD">Reward</option>
          <option value="DISCIPLINARY">Disciplinary</option>
        </select>
      </div>
      <div className="min-w-44 flex-1">
        <label htmlFor="log-desc" className="mb-0.5 block text-xs text-muted">Description</label>
        <input id="log-desc" name="description" required className={`${inputClass} py-1.5`} />
      </div>
      <div>
        <label htmlFor="log-cost" className="mb-0.5 block text-xs text-muted">Cost (₦)</label>
        <input id="log-cost" name="cost" type="number" min="0" step="0.01" className={`${inputClass} w-28 py-1.5`} />
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Logging…" : "Add log"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function AdvanceForm({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addAdvance, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="staffId" value={staffId} />
      <div>
        <label htmlFor="adv-amount" className="mb-0.5 block text-xs text-muted">Advance (₦)</label>
        <input id="adv-amount" name="amount" type="number" min="1" step="0.01" required className={`${inputClass} w-32 py-1.5`} />
      </div>
      <div>
        <label htmlFor="adv-cap" className="mb-0.5 block text-xs text-muted">Weekly deduction cap (₦)</label>
        <input id="adv-cap" name="weeklyDeductionCap" type="number" min="0" step="0.01" className={`${inputClass} w-40 py-1.5`} />
      </div>
      <div className="min-w-32 flex-1">
        <label htmlFor="adv-note" className="mb-0.5 block text-xs text-muted">Note</label>
        <input id="adv-note" name="note" className={`${inputClass} py-1.5`} />
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Granting…" : "Grant advance"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
