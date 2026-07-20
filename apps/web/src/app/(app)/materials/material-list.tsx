"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { deleteMaterialType, setSellable } from "./actions";

type Material = { id: string; name: string; kind: string; color: string | null; sellable: boolean };

const KIND_LABEL: Record<string, string> = {
  RAW: "Raw materials (purchased)",
  INTERMEDIATE: "Intermediate materials (in processing)",
  FINISHED: "Finished goods (sellable)",
};
const KIND_TONE = { RAW: "neutral", INTERMEDIATE: "info", FINISHED: "success" } as const;

function MaterialRow({ m, canEdit }: { m: Material; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sellable = m.kind === "FINISHED" || m.sellable;

  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-muted-bg py-1 pl-2.5 pr-1.5 text-sm">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: m.color ?? "#cbd5e1" }} aria-hidden />
      <span>{m.name}</span>
      {sellable && <span title="Sellable" className="text-[11px] font-medium text-success">₦</span>}
      {canEdit && m.kind !== "FINISHED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { setError(null); await setSellable(m.id, !m.sellable); })}
          className={`rounded px-1 text-[10px] font-medium ${m.sellable ? "text-success" : "text-muted hover:text-foreground"}`}
          title={m.sellable ? "Sellable — click to make non-sellable" : "Mark sellable"}
        >
          {m.sellable ? "sellable" : "sell?"}
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            setError(null);
            if (!confirm(`Delete "${m.name}"? This can't be undone.`)) return;
            const res = await deleteMaterialType(m.id);
            if (res?.error) setError(res.error);
          })}
          className="rounded-full px-1 leading-none text-muted hover:bg-destructive-soft hover:text-destructive disabled:opacity-50"
          title="Delete material"
          aria-label={`Delete ${m.name}`}
        >
          ×
        </button>
      )}
      {error && <span className="ml-1 max-w-[220px] text-[10px] text-destructive">{error}</span>}
    </li>
  );
}

export function MaterialList({ materials, canEdit }: { materials: Material[]; canEdit: boolean }) {
  const byKind = (k: string) => materials.filter((m) => m.kind === k);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {(["RAW", "INTERMEDIATE", "FINISHED"] as const).map((kind) => (
        <div key={kind} className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-medium">{KIND_LABEL[kind]}</h2>
            <Badge tone={KIND_TONE[kind]}>{byKind(kind).length}</Badge>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {byKind(kind).map((m) => <MaterialRow key={m.id} m={m} canEdit={canEdit} />)}
            {byKind(kind).length === 0 && <li className="text-sm text-muted">None yet.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
