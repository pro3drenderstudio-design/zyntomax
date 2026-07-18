"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import {
  createStageOutput, deleteStageOutput, setStagePayBasis, type FormState,
} from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };
export type StageOutputRow = {
  id: string;
  stageId: string;
  materialTypeId: string;
  name: string;
  color: string | null;
};

export function StageManager({
  stages,
  materials,
  outputs,
}: {
  stages: (Option & { payBasis: string })[];
  materials: Option[];
  outputs: StageOutputRow[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createStageOutput, {});
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [color, setColor] = useState("#7ed957");

  const currentStage = stages.find((s) => s.id === stageId);
  const rows = outputs.filter((o) => o.stageId === stageId && o.materialTypeId === materialId);

  return (
    <div className="flex flex-col gap-4">
      {/* Pay basis per stage */}
      <div>
        <p className="mb-1.5 text-sm font-medium">Pay basis per stage</p>
        <div className="flex flex-wrap gap-2">
          {stages.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm">
              <span>{s.name}</span>
              <form action={setStagePayBasis.bind(null, s.id, s.payBasis === "SCALE_IN" ? "SCALE_OUT" : "SCALE_IN")}>
                <button type="submit" className={`cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium ${s.payBasis === "SCALE_IN" ? "bg-info-soft text-info" : "bg-accent-soft text-accent"}`}>
                  {s.payBasis === "SCALE_IN" ? "Paid on scale-IN" : "Paid on scale-OUT"}
                </button>
              </form>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Tap to toggle. Sorters are usually paid on scale-in, crushers on scale-out.</p>
      </div>

      {/* Stage outputs */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-medium">Stage outputs by material</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <div>
            <label className={labelClass}>Stage</label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Input material</label>
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className={inputClass}>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted">
              No outputs defined for {currentStage?.name} + {materials.find((m) => m.id === materialId)?.name}. Add one below.
            </p>
          )}
          {rows.map((o) => (
            <span key={o.id} className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-2 pr-1 text-sm">
              <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: o.color ?? "#cbd5e1" }} aria-hidden />
              {o.name}
              <form action={deleteStageOutput.bind(null, o.id)}>
                <button type="submit" aria-label={`Delete ${o.name}`} className="cursor-pointer text-muted hover:text-destructive">
                  <X size={13} />
                </button>
              </form>
            </span>
          ))}
        </div>

        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="materialTypeId" value={materialId} />
          <div className="min-w-44 flex-1">
            <label className={labelClass}>New output name</label>
            <input name="name" required placeholder="e.g. PET caps, Pre-baled PET, HDPE" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Colour</label>
            <input name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border" />
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add output"}</button>
        </form>
        {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      </div>
    </div>
  );
}
