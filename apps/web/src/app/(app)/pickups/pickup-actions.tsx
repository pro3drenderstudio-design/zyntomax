"use client";

import { useState, useTransition } from "react";
import { schedulePickup, unschedulePickup, cancelPickup } from "./actions";

type Trip = { id: string; label: string; sameLocality: boolean };

export function PickupActions({
  pickupId, status, trips, compact = true,
}: {
  pickupId: string; status: string; trips: Trip[]; compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [tripId, setTripId] = useState("");

  if (status === "PENDING") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          disabled={pending || trips.length === 0}
          className="max-w-[200px] rounded-md border border-border bg-surface px-2 py-1 text-xs"
        >
          <option value="">{trips.length === 0 ? "No active trips" : "Assign to trip…"}</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>{t.sameLocality ? "★ " : ""}{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!tripId || pending}
          onClick={() => start(() => schedulePickup(pickupId, tripId))}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-on-primary hover:bg-accent-hover disabled:opacity-50"
        >
          Schedule
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => { if (confirm("Cancel this pickup request?")) start(() => cancelPickup(pickupId)); }}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-destructive-soft hover:text-destructive"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (status === "SCHEDULED") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => unschedulePickup(pickupId))}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted-bg"
        >
          Unschedule
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => { if (confirm("Cancel this pickup request?")) start(() => cancelPickup(pickupId)); }}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-destructive-soft hover:text-destructive"
        >
          Cancel
        </button>
      </div>
    );
  }

  return <span className="text-xs text-muted">—</span>;
}
