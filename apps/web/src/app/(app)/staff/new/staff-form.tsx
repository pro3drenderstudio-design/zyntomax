"use client";

import { useActionState } from "react";
import { createStaff, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

const ROLES = [
  { value: "PRODUCTION_STAFF", label: "Production staff (sorter/operator)" },
  { value: "COLLECTION_AGENT", label: "Collection agent" },
  { value: "TEAM_LEAD", label: "Team lead" },
  { value: "FACTORY_SUPERVISOR", label: "Factory supervisor" },
  { value: "PURCHASING_MANAGER", label: "Purchasing manager" },
  { value: "FINANCE_ADMIN", label: "Finance admin" },
  { value: "HR_ADMIN", label: "HR admin" },
  { value: "SALES_ADMIN", label: "Sales admin" },
  { value: "OPERATIONS_MANAGER", label: "Operations manager" },
  { value: "AUDITOR", label: "Auditor (read-only)" },
];

export function StaffForm({ sites }: { sites: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStaff,
    {},
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="st-name" className={labelClass}>Full name *</label>
          <input id="st-name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="st-phone" className={labelClass}>Phone *</label>
          <input id="st-phone" name="phone" type="tel" required placeholder="08012345678" className={inputClass} />
        </div>
        <div>
          <label htmlFor="st-email" className={labelClass}>Email</label>
          <input id="st-email" name="email" type="email" className={inputClass} />
        </div>
        <div>
          <label htmlFor="st-site" className={labelClass}>Site *</label>
          <select id="st-site" name="siteId" required className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="st-hire" className={labelClass}>Hire date</label>
          <input id="st-hire" name="hireDate" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="st-address" className={labelClass}>Address</label>
          <input id="st-address" name="address" className={inputClass} />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Roles *</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted-bg">
              <input type="checkbox" name="roles" value={r.value} className="accent-[#059669]" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Bank (for wages)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="st-bank" className={labelClass}>Bank name</label>
            <input id="st-bank" name="bankName" className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-acct" className={labelClass}>Account number</label>
            <input id="st-acct" name="bankAccountNo" inputMode="numeric" maxLength={10} className={inputClass} />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Next of kin & emergency contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="st-nok" className={labelClass}>Next of kin</label>
            <input id="st-nok" name="nextOfKinName" className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-nokp" className={labelClass}>Next of kin phone</label>
            <input id="st-nokp" name="nextOfKinPhone" type="tel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-em" className={labelClass}>Emergency contact</label>
            <input id="st-em" name="emergencyName" className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-emp" className={labelClass}>Emergency phone</label>
            <input id="st-emp" name="emergencyPhone" type="tel" className={inputClass} />
          </div>
        </div>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Registering…" : "Register staff member"}
      </button>
    </form>
  );
}
