"use client";

import { useActionState, useState } from "react";
import { createJob, completeJob, resolveJob, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };
export type StageOutputOption = { id: string; name: string; color: string | null };

export function CreateJobForm({
  sites,
  stages,
  materials,
  staff,
  routes,
}: {
  sites: Option[];
  stages: Option[];
  materials: Option[];
  staff: Option[];
  routes: { materialTypeId: string; stageId: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createJob, {});
  const [materialId, setMaterialId] = useState("");

  // Only stages on the selected material's route
  const validStageIds = new Set(
    routes.filter((r) => r.materialTypeId === materialId).map((r) => r.stageId),
  );
  const availableStages = materialId
    ? stages.filter((s) => validStageIds.has(s.id))
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="j-site" className={labelClass}>Site</label>
          <select id="j-site" name="siteId" required className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="j-material" className={labelClass}>Material</label>
          <select id="j-material" name="materialTypeId" required value={materialId} onChange={(e) => setMaterialId(e.target.value)} className={inputClass}>
            <option value="" disabled>— Select —</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="j-stage" className={labelClass}>Stage</label>
          <select id="j-stage" name="stageId" required className={inputClass} defaultValue="" disabled={!materialId}>
            <option value="" disabled>{materialId ? "— Select —" : "Pick material first"}</option>
            {availableStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="j-weight" className={labelClass}>Scale-in weight (kg)</label>
          <input id="j-weight" name="weightInKg" type="number" step="0.1" min="0.1" required className={inputClass} />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Assign staff (wage is split equally)</legend>
        <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {staff.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted-bg">
              <input type="checkbox" name="staffIds" value={s.id} className="accent-[#008037]" />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
        {pending ? "Creating…" : "Create job"}
      </button>
    </form>
  );
}

export function CompleteJobForm({
  jobId,
  outputs,
}: {
  jobId: string;
  outputs: StageOutputOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeJob, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      {outputs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">Scale out each output type (kg)</p>
          {outputs.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <input type="hidden" name="stageOutputId" value={o.id} />
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: o.color ?? "#cbd5e1" }}
                aria-hidden
              />
              <span className="w-40 text-sm">{o.name}</span>
              <input name="outWeight" type="number" step="0.1" min="0" defaultValue={0} aria-label={`${o.name} kg`} className={`${inputClass} w-28 py-1.5`} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label htmlFor={`out-${jobId}`} className="mb-0.5 block text-xs text-muted">Good output (kg)</label>
          <input id={`out-${jobId}`} name="weightOutKg" type="number" step="0.1" min="0" required className={`${inputClass} w-40 py-1.5`} />
        </div>
      )}
      <div className="flex items-end gap-2">
        <div>
          <label htmlFor={`waste-${jobId}`} className="mb-0.5 block text-xs text-muted">Waste (kg)</label>
          <input id={`waste-${jobId}`} name="wasteKg" type="number" step="0.1" min="0" required className={`${inputClass} w-28 py-1.5`} />
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
          {pending ? "Scaling out…" : "Scale out"}
        </button>
      </div>
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function ResolveJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resolveJob, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-0.5 block text-xs text-muted">How to resolve</label>
          <select name="resolution" defaultValue="OVERLOOK" className={`${inputClass} w-56 py-1.5`}>
            <option value="OVERLOOK">Overlook (write off as loss)</option>
            <option value="CHARGE_STAFF">Deduct from assigned staff pay</option>
            <option value="CHARGE_SUPERVISOR">Deduct from my (supervisor) pay</option>
          </select>
        </div>
        <div className="min-w-52 flex-1">
          <label className="mb-0.5 block text-xs text-muted">Resolution note</label>
          <input name="reason" required placeholder="What happened?" className={`${inputClass} py-1.5`} />
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
          {pending ? "Resolving…" : "Resolve & release"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Charges are valued at the material&apos;s cost per kg and appear on the next payroll as a deduction.
      </p>
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
