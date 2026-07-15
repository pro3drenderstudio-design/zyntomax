import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "destructive";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "";
  return (
    <Card className="min-w-0">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`tabular mt-1 truncate text-2xl font-semibold ${valueClass}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </Card>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "bg-muted-bg text-foreground",
  success: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
  info: "bg-info-soft text-info",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof badgeTones {
  const map: Record<string, keyof typeof badgeTones> = {
    ACTIVE: "success",
    COMPLETED: "success",
    SUCCESS: "success",
    PAID: "success",
    APPROVED: "success",
    DELIVERED: "success",
    RESOLVED: "success",
    CONFIRMED: "info",
    IN_PROGRESS: "info",
    PROCESSING: "info",
    SCHEDULED: "info",
    DEPARTED: "info",
    OPEN: "info",
    READY: "info",
    PLANNED: "neutral",
    PENDING: "warning",
    RETURNED: "warning",
    RECONCILED: "info",
    AWAITING_FUNDS: "warning",
    PARTIAL: "warning",
    PARTIALLY_DISPATCHED: "warning",
    UNPAID: "warning",
    FLAGGED: "destructive",
    FAILED: "destructive",
    PARTIAL_FAILED: "destructive",
    OVERDUE: "destructive",
    CANCELLED: "destructive",
    BLACKLISTED: "destructive",
    SUSPENDED: "destructive",
  };
  return map[status] ?? "neutral";
}

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-sm">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border bg-muted-bg text-left">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </Card>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-accent-hover"
    >
      {children}
    </Link>
  );
}

export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
export const labelClass = "mb-1 block text-sm font-medium";
export const buttonClass =
  "cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-accent-hover disabled:opacity-60";
export const secondaryButtonClass =
  "cursor-pointer rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-muted-bg";

export function formatNaira(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function formatKg(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${n.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg`;
}
