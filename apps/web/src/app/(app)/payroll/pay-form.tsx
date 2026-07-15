"use client";

import { markItemPaid } from "./actions";
import { inputClass, buttonClass } from "@/components/ui";

export function PayForm({ itemId }: { itemId: string }) {
  return (
    <form action={markItemPaid.bind(null, itemId)} className="flex items-center gap-1.5">
      <input
        name="paymentRef"
        placeholder="Transfer ref"
        aria-label="Payment reference"
        className={`${inputClass} w-32 py-1`}
      />
      <button type="submit" className={`${buttonClass} px-2.5 py-1 text-xs`}>
        Mark paid
      </button>
    </form>
  );
}
