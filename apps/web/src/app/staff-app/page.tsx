import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get the Zyntomax Admin app",
  description: "Run Zyntomax on the go — collections, production, approvals, finance and payroll, role-gated to what you manage.",
};

export const dynamic = "force-dynamic";

const SUPPORT_PHONE = "08038830882";

const FEATURES = [
  { icon: "🚛", title: "Collection", desc: "Record weigh-ins with photo & signature, track trips, and register vendors from the field." },
  { icon: "🏭", title: "Production", desc: "Scale jobs in and out, weigh recipe outputs, and see discrepancies against tolerance live." },
  { icon: "✅", title: "Approvals", desc: "Approve reconciled trips and clear the withdrawal queue with instant, float-safe payouts." },
  { icon: "📊", title: "Finance", desc: "Record expenses, review a monthly P&L, and watch sales receivables age." },
  { icon: "👥", title: "People & payroll", desc: "Run weekly payroll, mark payslips paid, and manage the staff directory." },
  { icon: "💚", title: "My earnings", desc: "Every staff member sees their own live wage — commission, base and past payslips." },
];

const STEPS = [
  "Tap “Download the app” to get the APK file.",
  "Open it. If your phone warns about “unknown sources”, allow installs from your browser, then continue.",
  "Tap Install, then Open.",
  "Sign in with your Zyntomax phone number and password — the app shows only what your role allows.",
];

export default function StaffAppPage() {
  const APK_URL = process.env.ZYNTOMAX_ADMIN_APK_URL || "";
  return (
    <main style={{ background: "#0b3d24", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(160deg,#008037 0%,#0b3d24 100%)", padding: "56px 20px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Zyntomax" width={72} height={72} style={{ objectFit: "contain", marginBottom: 16 }} />
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "0 0 8px" }}>Zyntomax Admin</h1>
          <p style={{ fontSize: 20, opacity: 0.9, margin: "0 0 8px", fontWeight: 600 }}>The whole operation, in your pocket.</p>
          <p style={{ fontSize: 16, opacity: 0.85, maxWidth: 540, margin: "0 auto 28px" }}>
            The staff & admin app for Zyntomax. Collections, factory production, approvals, finance and payroll — everything you manage on the web, now on the go and gated to your role.
          </p>
          {APK_URL ? (
            <a href={APK_URL} style={{ display: "inline-block", background: "#7ed957", color: "#06331d", fontWeight: 800, fontSize: 18, padding: "16px 32px", borderRadius: 14, textDecoration: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
              ⬇ Download the app (Android)
            </a>
          ) : (
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700, fontSize: 17, padding: "16px 28px", borderRadius: 14 }}>
              Download link coming shortly — check back soon
            </div>
          )}
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 14 }}>Android APK · Staff only · Sign in with your Zyntomax account</p>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "#f4f7f5", color: "#0f172a", padding: "48px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 28 }}>Everything the web app does — wherever you are</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#fff", border: "1px solid #e3e8e5", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 24 }}>
            Works offline in the field · Fingerprint app-lock · Push alerts · English, Yoruba, Hausa & Pidgin
          </p>
        </div>
      </section>

      {/* How to install */}
      <section style={{ background: "#fff", color: "#0f172a", padding: "48px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>How to install</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {STEPS.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 15, background: "#008037", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span style={{ fontSize: 15, paddingTop: 4 }}>{s}</span>
              </li>
            ))}
          </ol>
          {APK_URL && (
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <a href={APK_URL} style={{ display: "inline-block", background: "#008037", color: "#fff", fontWeight: 700, padding: "14px 28px", borderRadius: 12, textDecoration: "none" }}>Download now</a>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#06331d", padding: "28px 20px", textAlign: "center", fontSize: 14, opacity: 0.85 }}>
        <p style={{ margin: "0 0 4px" }}>Trouble signing in? Call <a href={`tel:${SUPPORT_PHONE}`} style={{ color: "#7ed957", fontWeight: 700 }}>{SUPPORT_PHONE}</a></p>
        <p style={{ margin: 0, opacity: 0.7 }}>© Zyntomax Ventures Limited · Staff & Operations app</p>
      </footer>
    </main>
  );
}
