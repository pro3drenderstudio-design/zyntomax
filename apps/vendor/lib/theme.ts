// Zyntomax Vendor — design tokens. Light-first; brand green (#008037).

export const colors = {
  accent: "#22A94E",
  accentDark: "#178A3E",
  accentSoft: "#dcf6e2",
  lime: "#7ed957",
  limeSoft: "#edfbe2",
  bg: "#f4f7f5",
  bgAlt: "#eef3ef",
  surface: "#ffffff",
  surfaceAlt: "#f8faf9",
  text: "#0f172a",
  textOnAccent: "#ffffff",
  muted: "#64748b",
  mutedLight: "#94a3b8",
  border: "#e3e8e5",
  borderStrong: "#cfd8d2",
  destructive: "#dc2626",
  destructiveSoft: "#fee2e2",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  info: "#2563eb",
  infoSoft: "#dbeafe",
  success: "#16a34a",
  successSoft: "#dcfce7",
  overlay: "rgba(15, 23, 42, 0.5)",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  smallStrong: { fontSize: 13, fontWeight: "600" as const },
  tiny: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.3 },
};

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/** Consistent colour for a status string across the app. */
export function statusColor(status: string): { fg: string; bg: string } {
  const s = status.toUpperCase();
  if (["SUCCESS", "PAID", "COLLECTED", "COMPLETED", "ACTIVE", "APPROVED"].includes(s))
    return { fg: colors.success, bg: colors.successSoft };
  if (["PENDING", "PROCESSING", "SCHEDULED", "AWAITING_FUNDS", "READY"].includes(s))
    return { fg: colors.warning, bg: colors.warningSoft };
  if (["FAILED", "CANCELLED", "REJECTED", "REVERSED", "BLACKLISTED"].includes(s))
    return { fg: colors.destructive, bg: colors.destructiveSoft };
  return { fg: colors.muted, bg: colors.bgAlt };
}
