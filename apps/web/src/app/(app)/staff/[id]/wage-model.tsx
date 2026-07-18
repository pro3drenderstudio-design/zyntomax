"use client";

import { useActionState, useState } from "react";
import { setStaffWage } from "../../settings/actions";
import type { FormState } from "../../settings/actions";
import { inputClass, buttonClass, Card, formatNaira } from "@/components/ui";

const LABELS: Record<string, string> = {
  COMMISSION: "Commission only (piece-rate on output)",
  SALARY: "Salary only (fixed weekly)",
  COMMISSION_PLUS_BASE: "Commission + base salary",
};

export function WageModelCard({
  staffId,
  wageModel,
  baseSalaryWeekly,
}: {
  staffId: string;
  wageModel: string;
  baseSalaryWeekly: number | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(setStaffWage, {});
  const [model, setModel] = useState(wageModel);

  return (
    <Card>
      <h2 className="mb-1 text-sm font-medium">Wage model</h2>
      <p className="mb-3 text-xs text-muted">
        How this staff member is paid. Piece-rates are set in Settings; the base salary is per staff.
      </p>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="staffId" value={staffId} />
        <select name="wageModel" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass}>
          {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {model !== "COMMISSION" && (
          <div>
            <label className="mb-0.5 block text-xs text-muted">Weekly base salary (₦)</label>
            <input name="baseSalaryWeekly" type="number" min="0" step="0.01" defaultValue={baseSalaryWeekly ?? ""} required className={inputClass} />
          </div>
        )}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
          {pending ? "Saving…" : "Save wage model"}
        </button>
      </form>
      {wageModel !== "COMMISSION" && baseSalaryWeekly ? (
        <p className="mt-2 text-xs text-muted">Currently: {LABELS[wageModel]} · {formatNaira(baseSalaryWeekly)}/week base</p>
      ) : null}
    </Card>
  );
}
