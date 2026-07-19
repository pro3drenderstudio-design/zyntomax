"use client";

import { useActionState, useState } from "react";
import { createMaterialType, createStage, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export function CreateMaterialForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createMaterialType, {});
  const [color, setColor] = useState("#64748b");
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1">
        <label className={labelClass}>New material</label>
        <input name="name" required placeholder="e.g. HDPE, Crushed PP Blue" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Kind</label>
        <select name="kind" className={inputClass} defaultValue="RAW">
          <option value="RAW">Raw (purchased)</option>
          <option value="INTERMEDIATE">Intermediate (in processing)</option>
          <option value="FINISHED">Finished (sellable)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Colour</label>
        <input name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border" />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function CreateStageForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createStage, {});
  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label className={labelClass}>New process stage</label>
        <input name="name" required placeholder="e.g. Shredding" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
