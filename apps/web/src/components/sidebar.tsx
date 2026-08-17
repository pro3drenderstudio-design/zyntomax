"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Truck,
  Banknote,
  ShoppingCart,
  Factory,
  Boxes,
  Layers,
  Store,
  FileText,
  UserCog,
  Wallet,
  Receipt,
  Target,
  BarChart3,
  Settings,
  Menu,
  X,
  HandCoins,
  ClipboardList,
  Fuel,
  Navigation,
  Landmark,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavSection = { title: string; roles: string[]; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "",
    roles: ["*"],
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    title: "Collection",
    roles: [
      "SUPER_ADMIN",
      "OPERATIONS_MANAGER",
      "TEAM_LEAD",
      "COLLECTION_AGENT",
      "FACTORY_SUPERVISOR",
      "FINANCE_ADMIN",
      "AUDITOR",
    ],
    items: [
      { href: "/vendors", label: "Vendors", icon: <Users size={16} /> },
      { href: "/vendors/map", label: "Vendor Map", icon: <MapPin size={16} /> },
      { href: "/trips", label: "Trips", icon: <Truck size={16} /> },
      { href: "/agents", label: "Live Tracking", icon: <Navigation size={16} /> },
      { href: "/payouts", label: "Payouts", icon: <Banknote size={16} /> },
      { href: "/withdrawals", label: "Withdrawals", icon: <HandCoins size={16} /> },
    ],
  },
  {
    title: "Factory",
    roles: [
      "SUPER_ADMIN",
      "OPERATIONS_MANAGER",
      "FACTORY_SUPERVISOR",
      "PURCHASING_MANAGER",
      "AUDITOR",
    ],
    items: [
      { href: "/purchases", label: "Purchases", icon: <ShoppingCart size={16} /> },
      { href: "/suppliers", label: "Suppliers", icon: <Store size={16} /> },
      { href: "/production", label: "Production", icon: <Factory size={16} /> },
      { href: "/inventory", label: "Inventory", icon: <Boxes size={16} /> },
      { href: "/materials", label: "Materials & Stages", icon: <Layers size={16} /> },
    ],
  },
  {
    title: "Sales",
    roles: ["SUPER_ADMIN", "SALES_ADMIN", "FINANCE_ADMIN", "AUDITOR"],
    items: [
      { href: "/customers", label: "Customers", icon: <Store size={16} /> },
      { href: "/orders", label: "Sales", icon: <FileText size={16} /> },
      { href: "/invoices", label: "Invoices", icon: <Receipt size={16} /> },
    ],
  },
  {
    title: "People",
    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER", "AUDITOR"],
    items: [
      { href: "/staff", label: "Staff", icon: <UserCog size={16} /> },
      { href: "/payroll", label: "Payroll", icon: <HandCoins size={16} /> },
      { href: "/issuances", label: "PPE & Logs", icon: <ClipboardList size={16} /> },
    ],
  },
  {
    title: "Finance",
    roles: ["SUPER_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER", "AUDITOR"],
    items: [
      { href: "/expenses", label: "Expenses", icon: <Receipt size={16} /> },
      { href: "/accounts", label: "Cash Accounts", icon: <Landmark size={16} /> },
      { href: "/wallet", label: "Wallet", icon: <Wallet size={16} /> },
      { href: "/diesel", label: "Diesel", icon: <Fuel size={16} /> },
      { href: "/budgets", label: "Budgets", icon: <Target size={16} /> },
      { href: "/reports", label: "Reports", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "",
    roles: ["SUPER_ADMIN", "OPERATIONS_MANAGER"],
    items: [
      { href: "/settings", label: "Settings", icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visible = SECTIONS.filter(
    (s) =>
      s.roles.includes("*") ||
      roles.includes("SUPER_ADMIN") ||
      s.roles.some((r) => roles.includes(r)),
  );

  const nav = (
    <nav className="flex flex-col gap-4 p-3">
      {visible.map((section, i) => (
        <div key={i}>
          {section.title && (
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ${
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-foreground hover:bg-muted-bg"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 print:hidden lg:hidden">
        <span className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Zyntomax" className="h-7 w-7 object-contain" />
          Zyntomax
        </span>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer rounded-md p-2 hover:bg-muted-bg"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="border-b border-border bg-surface lg:hidden">{nav}</div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface print:!hidden lg:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Zyntomax" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-tight">Zyntomax</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Operations</p>
          </div>
        </div>
        {nav}
      </aside>
    </>
  );
}
