"use client";

import { useActionState, useState } from "react";
import { scaleInBatch, type FormState } from "../actions";
import { inputClass, buttonClass, secondaryButtonClass } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; name: string };

export function ScaleInForm({
  batchId,
  materials,
}: {
  batchId: string;
  materials: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    scaleInBatch,
    {},
  );
  const [rows, setRows] = useState([0]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="batchId" value={batchId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1.5 pr-3">Material</th>
              <th className="py-1.5 pr-3">Scaled weight (kg)</th>
              <th className="py-1.5 pr-3">Agreed price (₦/kg)</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((rowId) => (
              <tr key={rowId}>
                <td className="py-1.5 pr-3">
                  <select
                    name="materialTypeId" required defaultValue=""
                    aria-label="Material type" className={`${inputClass} w-44`}
                  >
                    <option value="" disabled>— Select —</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    name="weightKg" type="number" step="0.1" min="0.1" required
                    aria-label="Weight in kg" className={`${inputClass} w-32`}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    name="pricePerKg" type="number" step="0.01" min="0" required
                    aria-label="Price per kg" className={`${inputClass} w-32`}
                  />
                </td>
                <td className="py-1.5">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => setRows((r) => r.filter((x) => x !== rowId))}
                      className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}
          className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
        >
          <Plus size={14} aria-hidden /> Add material line
        </button>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Scaling in…" : "Scale in batch"}
        </button>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
