"use client";

import { useActionState, useState } from "react";
import { createJob, completeJob, resolveJob, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };
export type InputOption = { materialId: string; name: string; kind: string; availableKg: number; stageIds: string[] };
export type OutputOption = { id: string; name: string; color: string | null };

export function CreateJobForm({
  sites,
  stages,
  staff,
  inputsBySite,
}: {
  sites: Option[];
  stages: Option[];
  staff: Option[];
  inputsBySite: Record<string, InputOption[]>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createJob, {});
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [materialId, setMaterialId] = useState("");

  const inputs = inputsBySite[siteId] ?? [];
  const selected = inputs.find((i) => i.materialId === materialId);
  const availableStages = selected ? stages.filter((s) => selected.stageIds.includes(s.id)) : [];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Site</label>
          <select name="siteId" required value={siteId} onChange={(e) => { setSiteId(e.target.value); setMaterialId(""); }} className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Input material (in stock)</label>
          <select name="materialTypeId" required value={materialId} onChange={(e) => setMaterialId(e.target.value)} className={inputClass}>
            <option value="" disabled>{inputs.length ? "— Select —" : "Nothing available"}</option>
            {inputs.map((i) => (
              <option key={i.materialId} value={i.materialId}>
                {i.name} — {i.availableKg.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg {i.kind === "RAW" ? "(raw)" : "(in processing)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Stage</label>
          <select name="stageId" required className={inputClass} defaultValue="" disabled={!materialId}>
            <option value="" disabled>{materialId ? "— Select —" : "Pick material first"}</option>
            {availableStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Scale-in weight (kg){selected ? ` · max ${selected.availableKg.toLocaleString("en-NG", { maximumFractionDigits: 1 })}` : ""}</label>
          <input name="weightInKg" type="number" step="0.1" min="0.1" max={selected?.availableKg} required className={inputClass} />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Assign staff (wage split equally)</legend>
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
  outputs: OutputOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeJob, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <p className="text-xs font-medium text-muted">Scale out each output material (kg)</p>
      <div className="flex flex-col gap-1.5">
        {outputs.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <input type="hidden" name="outputMaterialTypeId" value={o.id} />
            <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: o.color ?? "#cbd5e1" }} aria-hidden />
            <span className="w-40 text-sm">{o.name}</span>
            <input name="outWeight" type="number" step="0.1" min="0" defaultValue={0} aria-label={`${o.name} kg`} className={`${inputClass} w-28 py-1.5`} />
          </div>
        ))}
        {outputs.length === 0 && <p className="text-xs text-destructive">No recipe outputs defined for this stage/material.</p>}
      </div>
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
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
