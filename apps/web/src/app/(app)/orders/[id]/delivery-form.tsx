"use client";

import { useActionState } from "react";
import { setDelivery, type FormState } from "../actions";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

export function DeliveryForm({
  orderId,
  driverName,
  truckNo,
  waybillNo,
}: {
  orderId: string;
  driverName: string | null;
  truckNo: string | null;
  waybillNo: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setDelivery, {});
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label htmlFor="d-driver" className={labelClass}>Driver</label>
        <input id="d-driver" name="driverName" defaultValue={driverName ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor="d-truck" className={labelClass}>Truck number</label>
        <input id="d-truck" name="truckNo" defaultValue={truckNo ?? ""} placeholder="e.g. LND-234-XA" className={inputClass} />
      </div>
      <div>
        <label htmlFor="d-waybill" className={labelClass}>Waybill number</label>
        <input id="d-waybill" name="waybillNo" defaultValue={waybillNo ?? ""} className={inputClass} />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save details"}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-4">{state.error}</p>}
    </form>
  );
}
