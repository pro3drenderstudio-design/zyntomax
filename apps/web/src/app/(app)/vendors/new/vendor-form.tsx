"use client";

import { useActionState, useState } from "react";
import { createVendor, updateVendor, type VendorFormState } from "../actions";
import { LocationPicker } from "./location-picker";
import { ImageUpload } from "@/components/image-upload";
import { inputClass, labelClass, buttonClass } from "@/components/ui";

type Option = { id: string; name: string };
export type VendorEditData = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  photoUrl: string | null;
  address: string | null;
  siteId: string;
  localityId: string | null;
  lat: number | null;
  lng: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
};

export function VendorForm({
  sites,
  localities,
  banks,
  vendor,
}: {
  sites: Option[];
  localities: (Option & { siteId: string })[];
  banks: { name: string; code: string }[];
  vendor?: VendorEditData;
}) {
  const isEdit = !!vendor;
  const [state, formAction, pending] = useActionState<VendorFormState, FormData>(
    isEdit ? updateVendor : createVendor,
    {},
  );
  const [siteId, setSiteId] = useState(vendor?.siteId ?? sites[0]?.id ?? "");
  const siteLocalities = localities.filter((l) => l.siteId === siteId);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm"
    >
      {isEdit && <input type="hidden" name="id" value={vendor.id} />}

      <ImageUpload name="photoUrl" label="Vendor photo" initialUrl={vendor?.photoUrl} shape="circle" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>Full name *</label>
          <input id="name" name="name" required defaultValue={vendor?.name} className={inputClass} />
        </div>
        <div>
          <label htmlFor="nickname" className={labelClass}>Nickname / alias</label>
          <input id="nickname" name="nickname" defaultValue={vendor?.nickname ?? ""} placeholder="What collectors call them" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>Phone number *</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" required defaultValue={vendor?.phone} placeholder="08012345678" className={inputClass} />
        </div>
        <div>
          <label htmlFor="siteId" className={labelClass}>Site *</label>
          <select id="siteId" name="siteId" required value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputClass}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="localityId" className={labelClass}>Locality</label>
          <select id="localityId" name="localityId" className={inputClass} defaultValue={vendor?.localityId ?? ""}>
            <option value="">— Select —</option>
            {siteLocalities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="address" className={labelClass}>House address</label>
          <input id="address" name="address" defaultValue={vendor?.address ?? ""} className={inputClass} />
        </div>
      </div>

      <LocationPicker initialLat={vendor?.lat ?? undefined} initialLng={vendor?.lng ?? undefined} />

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Bank account (for automatic payment)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bankCode" className={labelClass}>Bank</label>
            <select
              id="bankCode" name="bankCode" className={inputClass}
              defaultValue={banks.find((b) => b.name === vendor?.bankName)?.code ?? ""}
              onChange={(e) => {
                const bank = banks.find((b) => b.code === e.target.value);
                const hidden = document.getElementById("bankName") as HTMLInputElement | null;
                if (hidden) hidden.value = bank?.name ?? "";
              }}
            >
              <option value="">— Select bank —</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <input type="hidden" id="bankName" name="bankName" defaultValue={vendor?.bankName ?? ""} />
          </div>
          <div>
            <label htmlFor="bankAccountNo" className={labelClass}>Account number</label>
            <input id="bankAccountNo" name="bankAccountNo" inputMode="numeric" maxLength={10} pattern="\d{10}" defaultValue={vendor?.bankAccountNo ?? ""} className={inputClass} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">The account name is verified with the bank before the vendor can be paid.</p>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : isEdit ? "Save changes" : "Register vendor"}
      </button>
    </form>
  );
}
