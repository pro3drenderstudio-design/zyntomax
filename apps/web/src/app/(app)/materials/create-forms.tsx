"use client";

import { useActionState } from "react";
import { createMaterialType, createStage, type FormState } from "./actions";
import { inputClass, buttonClass } from "@/components/ui";

export function CreateMaterialForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createMaterialType,
    {},
  );
  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="new-material" className="mb-1 block text-xs font-medium text-muted">
          New material type
        </label>
        <input id="new-material" name="name" required placeholder="e.g. Copper" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function CreateStageForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStage,
    {},
  );
  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="new-stage" className="mb-1 block text-xs font-medium text-muted">
          New process stage
        </label>
        <input id="new-stage" name="name" required placeholder="e.g. Shredding" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
