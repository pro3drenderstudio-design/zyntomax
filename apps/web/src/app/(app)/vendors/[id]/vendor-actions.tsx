"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { setVendorStatus, deleteVendor } from "../actions";
import { Pencil, MoreVertical, Power, Ban, Trash2, CheckCircle } from "lucide-react";

export function VendorActions({
  vendorId,
  status,
  hasHistory,
}: {
  vendorId: string;
  status: string;
  hasHistory: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/vendors/${vendorId}/edit`}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-muted-bg"
      >
        <Pencil size={15} aria-hidden /> Edit
      </Link>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface hover:bg-muted-bg"
          aria-label="More actions"
        >
          <MoreVertical size={16} />
        </button>
        {open && (
          <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {status !== "ACTIVE" && (
              <form action={setVendorStatus.bind(null, vendorId, "ACTIVE")}>
                <button type="submit" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted-bg">
                  <CheckCircle size={15} className="text-accent" /> Activate
                </button>
              </form>
            )}
            {status !== "INACTIVE" && (
              <form action={setVendorStatus.bind(null, vendorId, "INACTIVE")}>
                <button type="submit" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted-bg">
                  <Power size={15} className="text-warning" /> Deactivate
                </button>
              </form>
            )}
            {status !== "BLACKLISTED" && (
              <form action={setVendorStatus.bind(null, vendorId, "BLACKLISTED")}>
                <button type="submit" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted-bg">
                  <Ban size={15} className="text-destructive" /> Blacklist
                </button>
              </form>
            )}
            <form
              action={deleteVendor.bind(null, vendorId)}
              onSubmit={(e) => {
                if (!confirm(
                  hasHistory
                    ? "This vendor has collection history and will be blacklisted (records are kept). Continue?"
                    : "Permanently delete this vendor? This cannot be undone.",
                )) e.preventDefault();
              }}
            >
              <button type="submit" className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive-soft">
                <Trash2 size={15} /> {hasHistory ? "Remove (blacklist)" : "Delete"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
