"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, LogOut, UserCog } from "lucide-react";
import { logout } from "@/app/(app)/actions";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATIONS_MANAGER: "Operations Manager",
  FACTORY_SUPERVISOR: "Factory Supervisor",
  FINANCE_ADMIN: "Finance Admin",
  PURCHASING_MANAGER: "Purchasing Manager",
  HR_ADMIN: "HR Admin",
  SALES_ADMIN: "Sales Admin",
  TEAM_LEAD: "Team Lead",
  COLLECTION_AGENT: "Collection Agent",
  PRODUCTION_STAFF: "Production Staff",
  AUDITOR: "Auditor",
};

export function HeaderBar({
  name,
  role,
  photoUrl,
  staffId,
}: {
  name: string;
  role: string;
  photoUrl: string | null;
  staffId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const showBack = pathname !== "/";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2 backdrop-blur print:hidden lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-muted-bg hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft size={16} aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors duration-150 hover:bg-muted-bg"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-primary">
              {initials}
            </span>
          )}
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium">{name}</span>
            <span className="block text-[11px] text-muted">{ROLE_LABEL[role] ?? role}</span>
          </span>
          <ChevronDown size={15} className="text-muted" aria-hidden />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-1.5 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          >
            <div className="border-b border-border px-3 py-2.5 sm:hidden">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[role] ?? role}</p>
            </div>
            {staffId && (
              <Link
                href={`/staff/${staffId}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-muted-bg"
                role="menuitem"
              >
                <UserCog size={15} aria-hidden /> My profile
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive transition-colors duration-150 hover:bg-destructive-soft"
                role="menuitem"
              >
                <LogOut size={15} aria-hidden /> Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
