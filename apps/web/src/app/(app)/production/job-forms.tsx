"use client";

import { useActionState } from "react";
import { createJob, completeJob, resolveJob, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function CreateJobForm({
  sites,
  stages,
  materials,
  staff,
}: {
  sites: Option[];
  stages: Option[];
  materials: Option[];
  staff: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createJob,
    {},
  );

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
          <select id="j-material" name="materialTypeId" required className={inputClass} defaultValue="">
            <option value="" disabled>— Select —</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="j-stage" className={labelClass}>Stage</label>
          <select id="j-stage" name="stageId" required className={inputClass} defaultValue="">
            <option value="" disabled>— Select —</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <input type="checkbox" name="staffIds" value={s.id} className="accent-[#059669]" />
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

export function CompleteJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    completeJob,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <div>
        <label htmlFor={`out-${jobId}`} className="mb-0.5 block text-xs text-muted">Good output (kg)</label>
        <input id={`out-${jobId}`} name="weightOutKg" type="number" step="0.1" min="0" required className={`${inputClass} w-28 py-1.5`} />
      </div>
      <div>
        <label htmlFor={`waste-${jobId}`} className="mb-0.5 block text-xs text-muted">Waste (kg)</label>
        <input id={`waste-${jobId}`} name="wasteKg" type="number" step="0.1" min="0" required className={`${inputClass} w-24 py-1.5`} />
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Scaling out…" : "Scale out"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function ResolveJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    resolveJob,
    {},
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="min-w-52 flex-1">
        <label htmlFor={`res-${jobId}`} className="mb-0.5 block text-xs text-muted">
          Resolution note (what happened?)
        </label>
        <input id={`res-${jobId}`} name="reason" required className={`${inputClass} py-1.5`} />
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass} px-3 py-1.5`}>
        {pending ? "Resolving…" : "Resolve & release"}
      </button>
      {state.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
