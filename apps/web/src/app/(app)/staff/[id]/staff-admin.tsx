"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  setStaffStatus, deleteStaff, updateStaffRoles, changeStaffPassword, type FormState,
} from "../actions";
import { inputClass, buttonClass, secondaryButtonClass } from "@/components/ui";
import { Pencil, MoreVertical, IdCard, KeyRound, Shield } from "lucide-react";

const ROLES = [
  "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN", "PURCHASING_MANAGER",
  "HR_ADMIN", "SALES_ADMIN", "TEAM_LEAD", "COLLECTION_AGENT", "PRODUCTION_STAFF", "AUDITOR",
];
const ROLE_LABEL = (r: string) => r.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");

export function StaffAdmin({
  staffId,
  status,
  currentRoles,
  siteId,
  canManage,
  isSuperAdmin,
}: {
  staffId: string;
  status: string;
  currentRoles: string[];
  siteId: string;
  canManage: boolean;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!canManage) {
    return (
      <Link href={`/staff/${staffId}/id-card`} className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}>
        <IdCard size={15} aria-hidden /> ID card
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/staff/${staffId}/id-card`} className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}>
        <IdCard size={15} aria-hidden /> ID card
      </Link>
      <Link href={`/staff/${staffId}/edit`} className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}>
        <Pencil size={15} aria-hidden /> Edit
      </Link>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface hover:bg-muted-bg" aria-label="More actions">
          <MoreVertical size={16} />
        </button>
        {open && (
          <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {isSuperAdmin && (
              <button type="button" onClick={() => { setShowRoles(true); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted-bg">
                <Shield size={15} className="text-accent" /> Manage roles
              </button>
            )}
            <button type="button" onClick={() => { setShowPw(true); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted-bg">
              <KeyRound size={15} className="text-info" /> Reset password
            </button>
            {status !== "ACTIVE" && (
              <form action={setStaffStatus.bind(null, staffId, "ACTIVE")}>
                <button type="submit" className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted-bg">Reinstate (Active)</button>
              </form>
            )}
            {status !== "SUSPENDED" && (
              <form action={setStaffStatus.bind(null, staffId, "SUSPENDED")}>
                <button type="submit" className="w-full px-3 py-2.5 text-left text-sm text-warning hover:bg-muted-bg">Suspend</button>
              </form>
            )}
            <form
              action={deleteStaff.bind(null, staffId)}
              onSubmit={(e) => { if (!confirm("Remove this staff member? If they have work history they will be marked as Exited instead of deleted.")) e.preventDefault(); }}
            >
              <button type="submit" className="w-full border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive-soft">Remove / mark exited</button>
            </form>
          </div>
        )}
      </div>

      {showRoles && (
        <RolesModal staffId={staffId} siteId={siteId} currentRoles={currentRoles} onClose={() => setShowRoles(false)} />
      )}
      {showPw && <PasswordModal staffId={staffId} onClose={() => setShowPw(false)} />}
    </div>
  );
}

function RolesModal({ staffId, siteId, currentRoles, onClose }: { staffId: string; siteId: string; currentRoles: string[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateStaffRoles, {});
  useEffect(() => { if (state && !state.error && pending === false) { /* keep open until success signalled by revalidate */ } }, [state, pending]);
  return (
    <Modal title="Manage roles" onClose={onClose}>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="staffId" value={staffId} />
        <input type="hidden" name="siteId" value={siteId} />
        <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {ROLES.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted-bg">
              <input type="checkbox" name="roles" value={r} defaultChecked={currentRoles.includes(r)} className="accent-[#008037]" />
              {ROLE_LABEL(r)}
            </label>
          ))}
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save roles"}</button>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Close</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeStaffPassword, {});
  return (
    <Modal title="Reset password" onClose={onClose}>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="staffId" value={staffId} />
        <input name="password" type="text" required minLength={6} placeholder="New password (min 6 chars)" className={inputClass} />
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Set password"}</button>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Close</button>
        </div>
        <p className="text-xs text-muted">Share the new password with the staff member; they can change it after signing in.</p>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
