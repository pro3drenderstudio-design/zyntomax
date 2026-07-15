import QRCode from "qrcode";

/**
 * Auto-generated staff ID card. The QR encodes the staff number and is used
 * to log in at factory scale stations. Print via the browser (Ctrl+P).
 */
export async function IdCard({
  name,
  staffNo,
  role,
  photoUrl,
  hireDate,
}: {
  name: string;
  staffNo: string;
  role: string;
  photoUrl?: string | null;
  hireDate?: Date | null;
}) {
  const qr = await QRCode.toDataURL(`ZYNTOMAX:STAFF:${staffNo}`, {
    margin: 1,
    width: 120,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <div
      className="w-[340px] overflow-hidden rounded-xl border border-border bg-white text-slate-900 shadow-md print:shadow-none"
      aria-label={`Staff ID card for ${name}`}
    >
      <div className="flex items-center justify-between bg-emerald-700 px-4 py-2.5 text-white">
        <div>
          <p className="text-sm font-bold leading-tight">ZYNTOMAX VENTURES LTD</p>
          <p className="text-[10px] uppercase tracking-wider opacity-80">Staff Identity Card</p>
        </div>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
          <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
          <path d="m14 16-3 3 3 3" />
          <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
          <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
          <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
        </svg>
      </div>
      <div className="flex gap-3 p-4">
        <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={`Photo of ${name}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-semibold text-slate-400">
              {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{name}</p>
          <p className="text-sm text-emerald-700">{role}</p>
          <p className="mt-1 font-mono text-sm">{staffNo}</p>
          {hireDate && (
            <p className="text-[11px] text-slate-500">
              Since {hireDate.toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${staffNo}`} className="h-[76px] w-[76px] shrink-0" />
      </div>
      <div className="bg-slate-100 px-4 py-1.5 text-center text-[10px] text-slate-500">
        This card remains the property of Zyntomax Ventures Limited
      </div>
    </div>
  );
}
