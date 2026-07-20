import QRCode from "qrcode";

export type IdCardData = {
  name: string;
  staffNo: string;
  role: string;
  title?: string | null; // job title printed on the card
  photoUrl?: string | null;
  hireDate?: Date | null;
  phone?: string | null;
};

const OFFICIAL_PHONE = "08038830882";

/**
 * Auto-generated staff ID card — front and back. The QR encodes the staff
 * number and doubles as the factory scale-station login. Rendered with the
 * company logo; printable to PDF via the browser.
 */
export async function IdCard({ data }: { data: IdCardData }) {
  const qr = await QRCode.toDataURL(`ZYNTOMAX:STAFF:${data.staffNo}`, {
    margin: 1,
    width: 140,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  const initials = data.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="flex flex-wrap gap-4">
      {/* FRONT */}
      <div className="w-[340px] overflow-hidden rounded-xl border border-border bg-white text-slate-900 shadow-md print:shadow-none">
        <div className="flex items-center gap-2 bg-[#008037] px-4 py-2.5 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 rounded bg-white/95 object-contain p-0.5" />
          <div>
            <p className="text-sm font-bold leading-tight">ZYNTOMAX VENTURES LTD</p>
            <p className="text-[10px] uppercase tracking-wider opacity-90">Staff Identity Card</p>
          </div>
        </div>
        <div className="flex gap-3 p-4">
          <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photoUrl} alt={`Photo of ${data.name}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-slate-400">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{data.name}</p>
            <p className="text-sm font-medium text-[#008037]">{data.title || data.role}</p>
            <p className="mt-1 font-mono text-sm">{data.staffNo}</p>
            {data.hireDate && (
              <p className="text-[11px] text-slate-500">
                Since {data.hireDate.toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
              </p>
            )}
            {data.phone && <p className="mt-1 text-[11px] text-slate-500">{data.phone}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" className="h-[76px] w-[76px] shrink-0 self-end" />
        </div>
        <div className="h-1.5 bg-[#7ed957]" />
      </div>

      {/* BACK */}
      <div className="flex w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-white text-slate-900 shadow-md print:shadow-none">
        <div className="h-1.5 bg-[#7ed957]" />
        <div className="flex-1 p-4 text-[12px] leading-relaxed">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#008037]">Cardholder details</p>
          <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium">{data.name}</dd>
            <dt className="text-slate-500">Staff No.</dt>
            <dd className="font-mono">{data.staffNo}</dd>
            {data.title && (<><dt className="text-slate-500">Title</dt><dd>{data.title}</dd></>)}
          </dl>
          <p className="mt-3 text-[11px] text-slate-600">
            If this card is found or lost, please call Zyntomax Ventures Limited on{" "}
            <span className="font-semibold text-slate-800">{OFFICIAL_PHONE}</span>.
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            This card remains company property and must be surrendered on exit.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
          <p className="text-[10px] text-slate-500">Zyntomax Ventures Limited · Recycling Operations</p>
        </div>
      </div>
    </div>
  );
}
