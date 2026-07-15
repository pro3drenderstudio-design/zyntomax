"use client";

import { useActionState, useState } from "react";
import { setRoute, type FormState } from "./actions";
import { buttonClass, secondaryButtonClass, inputClass } from "@/components/ui";
import { Plus, X, ArrowRight } from "lucide-react";

type Option = { id: string; name: string };

export function RouteEditor({
  materialTypeId,
  materialName,
  allStages,
  currentStageIds,
}: {
  materialTypeId: string;
  materialName: string;
  allStages: Option[];
  currentStageIds: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setRoute,
    {},
  );
  const [route, setRoute_] = useState<string[]>(currentStageIds);
  const [editing, setEditing] = useState(false);

  const stageName = (id: string) => allStages.find((s) => s.id === id)?.name ?? "?";
  const available = allStages.filter((s) => !route.includes(s.id));

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {currentStageIds.length === 0 ? (
          <span className="text-sm text-muted">No route set</span>
        ) : (
          currentStageIds.map((id, i) => (
            <span key={id} className="flex items-center gap-1.5 text-sm">
              {i > 0 && <ArrowRight size={13} className="text-muted" aria-hidden />}
              <span className="rounded-full bg-muted-bg px-2.5 py-0.5">{stageName(id)}</span>
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cursor-pointer text-sm text-accent hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="materialTypeId" value={materialTypeId} />
      {route.map((id) => (
        <input key={id} type="hidden" name="stageIds" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        {route.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5 text-sm">
            {i > 0 && <ArrowRight size={13} className="text-muted" aria-hidden />}
            <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-accent">
              {stageName(id)}
              <button
                type="button"
                aria-label={`Remove ${stageName(id)} from ${materialName} route`}
                onClick={() => setRoute_((r) => r.filter((x) => x !== id))}
                className="cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          </span>
        ))}
        {available.length > 0 && (
          <select
            aria-label={`Add stage to ${materialName} route`}
            className={`${inputClass} w-auto py-1 text-xs`}
            value=""
            onChange={(e) => {
              if (e.target.value) setRoute_((r) => [...r, e.target.value]);
            }}
          >
            <option value="">
              <Plus size={12} /> Add stage…
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending || route.length === 0} className={`${buttonClass} px-3 py-1.5`}>
          {pending ? "Saving…" : "Save route"}
        </button>
        <button
          type="button"
          onClick={() => { setRoute_(currentStageIds); setEditing(false); }}
          className={`${secondaryButtonClass} px-3 py-1.5`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
