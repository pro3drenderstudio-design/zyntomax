"use client";

import { useActionState, useState } from "react";
import { createTrip, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };

export function TripForm({
  sites,
  localities,
  leads,
  agents,
}: {
  sites: Option[];
  localities: (Option & { siteId: string })[];
  leads: Option[];
  agents: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createTrip,
    {},
  );
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="siteId" className={labelClass}>Site *</label>
          <select
            id="siteId" name="siteId" required value={siteId}
            onChange={(e) => setSiteId(e.target.value)} className={inputClass}
          >
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>Date *</label>
          <input id="date" name="date" type="date" required defaultValue={today} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="localityId" className={labelClass}>Locality</label>
          <select id="localityId" name="localityId" className={inputClass} defaultValue="">
            <option value="">— Whole area —</option>
            {localities.filter((l) => l.siteId === siteId).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Pending pickup requests in this locality are attached automatically.
          </p>
        </div>
        <div>
          <label htmlFor="vehicle" className={labelClass}>Vehicle</label>
          <input id="vehicle" name="vehicle" placeholder="e.g. Truck GGE-234-XA" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="leadId" className={labelClass}>Team lead *</label>
        <select id="leadId" name="leadId" required className={inputClass} defaultValue="">
          <option value="" disabled>— Select team lead —</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Team members</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {agents.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted-bg">
              <input type="checkbox" name="memberIds" value={a.id} className="accent-[#059669]" />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
