"use client";

import { useActionState, useState } from "react";
import { reconcileTrip, type FormState } from "../actions";
import { inputClass, buttonClass, formatKg } from "@/components/ui";

export type CollectedLine = {
  materialTypeId: string;
  materialName: string;
  collectedKg: number;
};

export function ReconcileForm({
  tripId,
  lines,
  tolerancePct,
}: {
  tripId: string;
  lines: CollectedLine[];
  tolerancePct: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    reconcileTrip,
    {},
  );
  const [remitted, setRemitted] = useState<Record<string, string>>({});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3">Material</th>
              <th className="py-2 pr-3">Collected (field)</th>
              <th className="py-2 pr-3">Remitted (factory scale)</th>
              <th className="py-2 pr-3">Variance</th>
              <th className="py-2">Reason (if beyond {tolerancePct}%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => {
              const r = Number(remitted[l.materialTypeId]);
              const hasR = remitted[l.materialTypeId] !== undefined && !Number.isNaN(r);
              const variance = hasR && l.collectedKg > 0
                ? ((l.collectedKg - r) / l.collectedKg) * 100
                : null;
              const beyond = variance !== null && Math.abs(variance) > tolerancePct;
              return (
                <tr key={l.materialTypeId}>
                  <td className="py-2 pr-3 font-medium">{l.materialName}</td>
                  <td className="tabular py-2 pr-3">{formatKg(l.collectedKg)}</td>
                  <td className="py-2 pr-3">
                    <input
                      name={`remitted_${l.materialTypeId}`}
                      type="number" step="0.1" min="0" required
                      aria-label={`Remitted kg for ${l.materialName}`}
                      className={`${inputClass} w-32`}
                      onChange={(e) =>
                        setRemitted((prev) => ({ ...prev, [l.materialTypeId]: e.target.value }))
                      }
                    />
                  </td>
                  <td className={`tabular py-2 pr-3 font-medium ${beyond ? "text-destructive" : variance !== null ? "text-accent" : "text-muted"}`}>
                    {variance === null ? "—" : `${variance > 0 ? "−" : "+"}${Math.abs(variance).toFixed(1)}%`}
                  </td>
                  <td className="py-2">
                    <input
                      name={`reason_${l.materialTypeId}`}
                      aria-label={`Variance reason for ${l.materialName}`}
                      className={`${inputClass} w-48`}
                      placeholder={beyond ? "Required" : "Optional"}
                      required={beyond ?? false}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? "Reconciling…" : "Save reconciliation"}
      </button>
    </form>
  );
}
