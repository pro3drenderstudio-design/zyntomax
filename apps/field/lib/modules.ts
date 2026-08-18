import type { Ionicons } from "@expo/vector-icons";

export type ModuleItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  roles: string[]; // "*" = everyone signed in
  built: boolean; // false → routes to a "coming soon" placeholder
};

export type ModuleSection = { section: string; items: ModuleItem[] };

/** The full mobile-admin surface, mirroring the web sidebar. Grows each phase. */
export const MODULES: ModuleSection[] = [
  {
    section: "Collection",
    items: [
      { key: "trips", label: "My Trips", icon: "car-outline", href: "/trips", roles: ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"], built: true },
      { key: "pickups", label: "Pickup Requests", icon: "cube-outline", href: "/pickups", roles: ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"], built: true },
      { key: "vendors", label: "Vendors", icon: "people-outline", href: "/vendors", roles: ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"], built: true },
      { key: "vendor-new", label: "Register Vendor", icon: "person-add-outline", href: "/vendor-new", roles: ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER"], built: true },
    ],
  },
  {
    section: "Operations",
    items: [
      { key: "admin", label: "Approvals & KPIs", icon: "stats-chart-outline", href: "/admin", roles: ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN"], built: true },
      { key: "outbox", label: "Offline Sync", icon: "cloud-upload-outline", href: "/outbox", roles: ["*"], built: true },
    ],
  },
  {
    section: "Factory",
    items: [
      { key: "production", label: "Production Jobs", icon: "hammer-outline", href: "/jobs", roles: ["PRODUCTION_STAFF", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], built: true },
      { key: "inventory", label: "Inventory", icon: "layers-outline", href: "/inventory", roles: ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], built: true },
    ],
  },
  {
    section: "Trade",
    items: [
      { key: "sales", label: "Sales & Invoices", icon: "cart-outline", href: "/sales", roles: ["SALES_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER"], built: true },
      { key: "purchases", label: "Purchases", icon: "cube-outline", href: "/purchases", roles: ["PURCHASING_MANAGER", "FINANCE_ADMIN", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], built: true },
    ],
  },
  {
    section: "Finance",
    items: [
      { key: "withdrawals", label: "Withdrawals", icon: "cash-outline", href: "/withdrawals", roles: ["FINANCE_ADMIN"], built: true },
      { key: "expenses", label: "Expenses", icon: "receipt-outline", href: "/expenses", roles: ["FINANCE_ADMIN", "OPERATIONS_MANAGER"], built: true },
      { key: "reports", label: "Reports", icon: "bar-chart-outline", href: "/reports", roles: ["FINANCE_ADMIN", "OPERATIONS_MANAGER"], built: true },
    ],
  },
  {
    section: "People",
    items: [
      { key: "staff", label: "Staff", icon: "id-card-outline", href: "/staff", roles: ["HR_ADMIN", "OPERATIONS_MANAGER"], built: true },
      { key: "payroll", label: "Payroll", icon: "wallet-outline", href: "/payroll", roles: ["HR_ADMIN", "FINANCE_ADMIN"], built: true },
    ],
  },
  {
    section: "Personal",
    items: [
      { key: "earnings", label: "My Earnings", icon: "cash-outline", href: "/earnings", roles: ["*"], built: true },
    ],
  },
];

export function canSee(item: ModuleItem, roles: string[]): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  if (item.roles.includes("*")) return true;
  return item.roles.some((r) => roles.includes(r));
}

export function visibleSections(roles: string[]): ModuleSection[] {
  return MODULES.map((s) => ({ section: s.section, items: s.items.filter((i) => canSee(i, roles)) })).filter((s) => s.items.length > 0);
}
