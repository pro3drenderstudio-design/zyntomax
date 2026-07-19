"use client";

import { useActionState, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { createRecipe, deleteRecipe, setStagePayBasis, type FormState } from "./actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Mat = { id: string; name: string; kind: string; color: string | null };
type Stage = { id: string; name: string; payBasis: string };
export type RecipeRow = { id: string; stageId: string; inputId: string; outputId: string };

export function RecipeManager({
  stages,
  materials,
  recipes,
}: {
  stages: Stage[];
  materials: Mat[];
  recipes: RecipeRow[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRecipe, {});
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [inputId, setInputId] = useState("");

  const matById = (id: string) => materials.find((m) => m.id === id);
  const rows = recipes.filter((r) => r.stageId === stageId && (!inputId || r.inputId === inputId));
  // Inputs can be raw or intermediate; outputs any non-raw material
  const inputMaterials = materials.filter((m) => m.kind !== "FINISHED");
  const outputMaterials = materials.filter((m) => m.kind !== "RAW");

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
        <p className="mt-1 text-xs text-muted">Sorters are usually paid on scale-in, crushers on scale-out.</p>
      </div>

      {/* Recipes */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-medium">Recipes — what each stage turns materials into</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <div>
            <label className={labelClass}>Stage</label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Filter by input</label>
            <select value={inputId} onChange={(e) => setInputId(e.target.value)} className={inputClass}>
              <option value="">All inputs</option>
              {inputMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-1.5">
          {rows.length === 0 && <p className="text-sm text-muted">No recipes for this stage yet. Add one below.</p>}
          {rows.map((r) => {
            const inp = matById(r.inputId);
            const out = matById(r.outputId);
            return (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted-bg px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: inp?.color ?? "#cbd5e1" }} aria-hidden />
                  {inp?.name}
                </span>
                <ArrowRight size={14} className="text-muted" aria-hidden />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: out?.color ?? "#cbd5e1" }} aria-hidden />
                  {out?.name}
                  <span className="text-xs text-muted">({out?.kind === "FINISHED" ? "finished" : "in-proc"})</span>
                </span>
                <form action={deleteRecipe.bind(null, r.id)}>
                  <button type="submit" aria-label="Remove recipe" className="cursor-pointer text-muted hover:text-destructive">
                    <X size={14} />
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="stageId" value={stageId} />
          <div>
            <label className={labelClass}>Input material</label>
            <select name="inputMaterialTypeId" required defaultValue={inputId} className={inputClass}>
              <option value="" disabled>— Select —</option>
              {inputMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <ArrowRight size={16} className="mb-2.5 text-muted" aria-hidden />
          <div>
            <label className={labelClass}>Produces</label>
            <select name="outputMaterialTypeId" required defaultValue="" className={inputClass}>
              <option value="" disabled>— Select —</option>
              {outputMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.kind === "FINISHED" ? "finished" : "in-proc"})</option>)}
            </select>
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add recipe"}</button>
        </form>
        {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
      </div>
    </div>
  );
}
