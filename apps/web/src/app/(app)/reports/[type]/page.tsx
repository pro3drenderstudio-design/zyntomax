import { notFound } from "next/navigation";
import Image from "next/image";
import { requireSession } from "@/lib/auth";
import { PageHeader, formatNaira, formatKg } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import {
  reportPeriod, pnlReport, productionReport, purchasesReport, salesReport,
  REPORT_TITLES, type ReportType,
} from "@/lib/reports";

const TYPES: ReportType[] = ["pnl", "production", "purchases", "sales"];

export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  await requireSession();
  const { type } = await params;
  const { month } = await searchParams;
  if (!TYPES.includes(type as ReportType)) notFound();
  const t = type as ReportType;
  const { period, from, to } = reportPeriod(month);
  const monthLabel = from.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={REPORT_TITLES[t]}
          subtitle={monthLabel}
          action={
            <form action={`/reports/${t}`} className="flex items-center gap-2">
              <input type="month" name="month" defaultValue={period} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm" />
              <button type="submit" className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted-bg">View</button>
              <PrintButton />
            </form>
          }
        />
      </div>

      {/* Printable letterhead */}
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 hidden items-center gap-3 border-b border-border pb-3 print:flex">
          <Image src="/logo.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <p className="text-lg font-bold">Zyntomax Ventures Limited</p>
            <p className="text-sm text-muted">{REPORT_TITLES[t]} · {monthLabel}</p>
          </div>
        </div>

        {t === "pnl" && <PnlBody from={from} to={to} />}
        {t === "production" && <ProductionBody from={from} to={to} />}
        {t === "purchases" && <PurchasesBody from={from} to={to} />}
        {t === "sales" && <SalesBody from={from} to={to} />}

        <p className="mt-6 text-xs text-muted">
          Generated {new Date().toLocaleString("en-NG")} · Zyntomax operations platform
        </p>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

async function PnlBody({ from, to }: { from: Date; to: Date }) {
  const r = await pnlReport(from, to);
  const rows: [string, number, boolean?][] = [
    ["Revenue (invoiced sales)", r.revenue],
    ["  Vendor collections cost", -r.vendorCost],
    ["  Raw material purchases", -r.purchaseCost],
    ["  Direct expenses", -r.directExpenses],
    ["  Production wages", -r.wages],
    ["Gross profit", r.grossProfit, true],
    ["  Operating expenses", -r.opex],
    ["Net profit", r.netProfit, true],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, val, bold]) => (
          <tr key={label} className={bold ? "border-y border-border bg-muted-bg font-semibold" : ""}>
            <td className="px-3 py-1.5">{label}</td>
            <td className={`tabular px-3 py-1.5 text-right ${val < 0 ? "text-muted" : bold ? (val < 0 ? "text-destructive" : "text-accent") : ""}`}>
              {val < 0 ? `−${formatNaira(-val)}` : formatNaira(val)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function ProductionBody({ from, to }: { from: Date; to: Date }) {
  const rows = await productionReport(from, to);
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Stage</Th><Th>Material</Th><Th right>Jobs</Th><Th right>In</Th><Th right>Out</Th><Th right>Waste</Th><Th right>Discrepancy</Th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border">
            <td className="px-3 py-1.5">{r.stage}</td>
            <td className="px-3 py-1.5">{r.material}</td>
            <td className="tabular px-3 py-1.5 text-right">{r.jobs}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatKg(r.inKg)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatKg(r.outKg)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatKg(r.wasteKg)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatKg(r.discrepancyKg)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted">No production this period.</td></tr>}
      </tbody>
    </table>
  );
}

async function PurchasesBody({ from, to }: { from: Date; to: Date }) {
  const rows = await purchasesReport(from, to);
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Lot</Th><Th>Date</Th><Th>Supplier</Th><Th>Type</Th><Th right>Weight</Th><Th right>Material ₦</Th><Th right>Landed ₦/kg</Th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border">
            <td className="tabular px-3 py-1.5">{r.lotNo}</td>
            <td className="px-3 py-1.5">{r.date.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-1.5">{r.supplier}</td>
            <td className="px-3 py-1.5">{r.type}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatKg(r.kg)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatNaira(r.materialCost)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatNaira(r.landedPerKg)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted">No purchases this period.</td></tr>}
      </tbody>
    </table>
  );
}

async function SalesBody({ from, to }: { from: Date; to: Date }) {
  const rows = await salesReport(from, to);
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <table className="w-full text-sm">
      <thead><tr><Th>Sale</Th><Th>Date</Th><Th>Customer</Th><Th>Items</Th><Th right>Total</Th><Th right>Outstanding</Th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border">
            <td className="tabular px-3 py-1.5">{r.orderNo}</td>
            <td className="px-3 py-1.5">{r.date.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-1.5">{r.customer}</td>
            <td className="px-3 py-1.5 text-muted">{r.items}</td>
            <td className="tabular px-3 py-1.5 text-right font-medium">{formatNaira(r.total)}</td>
            <td className="tabular px-3 py-1.5 text-right">{formatNaira(r.outstanding)}</td>
          </tr>
        ))}
        {rows.length > 0 && (
          <tr className="border-t border-border bg-muted-bg font-semibold">
            <td className="px-3 py-1.5" colSpan={4}>Total</td>
            <td className="tabular px-3 py-1.5 text-right">{formatNaira(total)}</td>
            <td />
          </tr>
        )}
        {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted">No sales this period.</td></tr>}
      </tbody>
    </table>
  );
}
