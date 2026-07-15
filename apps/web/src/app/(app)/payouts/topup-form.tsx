"use client";

import { useActionState } from "react";
import { topUpWallet, type FormState } from "./actions";
import { inputClass, buttonClass } from "@/components/ui";

export function TopUpForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    topUpWallet,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="amount" className="mb-1 block text-xs font-medium text-muted">
          Top-up amount (₦)
        </label>
        <input
          id="amount" name="amount" type="number" min="1" step="0.01" required
          className={`${inputClass} w-36`}
        />
      </div>
      <div>
        <label htmlFor="reference" className="mb-1 block text-xs font-medium text-muted">
          Bank reference
        </label>
        <input id="reference" name="reference" className={`${inputClass} w-40`} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Recording…" : "Record top-up"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-accent">{state.ok}</p>}
    </form>
  );
}
