import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zyntomax Ventures Limited — Recycling for a cleaner Nigeria",
  description:
    "Zyntomax turns everyday waste into valuable recycled materials — collecting from communities, processing at scale, and supplying industry. Sell your recyclables or partner with us.",
};

const PHONE = "08038830882";
const EMAIL = "info@zyntomax.com";

const STATS = [
  { value: "100%", label: "Traceable, weighed material" },
  { value: "4+", label: "Recycled product lines" },
  { value: "24/7", label: "On-demand pickups via the app" },
];

const STEPS = [
  { n: "01", icon: "📱", title: "Collect", desc: "Households and vendors request pickups in the app or through our field teams. Every load is weighed and logged." },
  { n: "02", icon: "🔍", title: "Sort", desc: "Materials are sorted by type and grade — PET, HDPE, PP, nylon and more — at our processing facility." },
  { n: "03", icon: "♻️", title: "Process", desc: "We crush, wash, pelletize and bale recyclables into clean, industry-ready raw materials." },
  { n: "04", icon: "🏭", title: "Supply", desc: "Finished recycled materials are sold to manufacturers, closing the loop and keeping waste out of landfills." },
];

const IMPACT = [
  { icon: "🌍", title: "Cleaner communities", desc: "Diverting plastic and post-consumer waste from streets, drains and dumpsites across Lagos and beyond." },
  { icon: "💚", title: "Circular economy", desc: "Turning what people throw away into the raw materials that local industry needs to grow." },
  { icon: "💰", title: "Income for recyclers", desc: "Everyday people and small collectors earn real, trackable income for the recyclables they gather." },
];

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-lg font-extrabold tracking-tight text-[#0f172a]">Zyntomax</span>
        </span>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#about" className="hover:text-[#008037]">About</a>
          <a href="#how" className="hover:text-[#008037]">How it works</a>
          <a href="#app" className="hover:text-[#008037]">For recyclers</a>
          <a href="#contact" className="hover:text-[#008037]">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#008037] sm:block">Staff sign in</Link>
          <Link href="/download" className="rounded-lg bg-[#008037] px-4 py-2 text-sm font-bold text-white hover:bg-[#006b2e]">Get the app</Link>
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  return (
    <main className="bg-white text-[#0f172a]" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#06331d] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#008037] opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#7ed957] opacity-20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7ed957]">Recycling · Made in Nigeria</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Turning everyday waste into <span className="text-[#7ed957]">real value</span>.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/85">
              Zyntomax Ventures Limited collects, sorts and recycles post-consumer waste into clean, industry-ready materials — building cleaner communities and a circular economy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/download" className="rounded-xl bg-[#7ed957] px-6 py-3.5 text-base font-bold text-[#06331d] shadow-lg shadow-black/20 hover:opacity-90">Sell your recyclables →</Link>
              <a href="#contact" className="rounded-xl border border-white/25 px-6 py-3.5 text-base font-bold text-white hover:bg-white/10">Partner with us</a>
            </div>
          </div>
          <div className="relative hidden justify-center md:flex">
            <div className="grid grid-cols-2 gap-4">
              {["♻️", "🌱", "🏭", "🚛"].map((e, i) => (
                <div key={i} className={`flex h-36 w-36 items-center justify-center rounded-3xl bg-white/10 text-6xl backdrop-blur ${i % 2 ? "translate-y-6" : ""}`}>{e}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-b border-black/5 bg-[#f4f7f5]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-10 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-[#008037]">{s.value}</p>
              <p className="mt-1 text-sm text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-4xl px-5 py-20 text-center">
        <span className="text-sm font-bold uppercase tracking-wide text-[#008037]">Our mission</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Waste is only waste until someone gives it value</h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          We believe the waste piling up in our communities is a resource in the wrong place. Zyntomax exists to change that — building the collection, processing and logistics that turn discarded plastic and materials into valuable inputs for industry, while putting income in the hands of the people who gather them.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#f4f7f5] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <span className="text-sm font-bold uppercase tracking-wide text-[#008037]">How it works</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">From your bin to industry-ready material</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{s.icon}</span>
                  <span className="text-sm font-extrabold text-[#008037]/40">{s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For recyclers (app) */}
      <section id="app" className="py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
          <div>
            <span className="text-sm font-bold uppercase tracking-wide text-[#008037]">For recyclers</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Recycle. Earn. Get paid.</h2>
            <p className="mt-4 text-lg text-slate-600">
              The Zyntomax Vendor app lets anyone turn recyclables into cash. Snap a photo, request a pickup, track your collector on a live map, and withdraw your earnings straight to your bank.
            </p>
            <ul className="mt-6 space-y-3">
              {["Request pickups with a photo — we come to you", "Track your collector live", "A wallet you withdraw to your bank", "Today's rates, rewards and referrals"].map((f) => (
                <li key={f} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dcf6e2] text-[#008037]">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/download" className="mt-8 inline-block rounded-xl bg-[#008037] px-6 py-3.5 text-base font-bold text-white hover:bg-[#006b2e]">Download the app</Link>
          </div>
          <div className="flex justify-center">
            <div className="w-64 rounded-[2.5rem] border-8 border-[#0f172a] bg-[#06331d] p-5 shadow-2xl">
              <div className="rounded-3xl bg-[#008037] p-5 text-white">
                <p className="text-xs opacity-80">AVAILABLE TO WITHDRAW</p>
                <p className="mt-1 text-3xl font-extrabold">₦ 24,500</p>
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl bg-white/15 p-3 text-sm">📸 Request a pickup</div>
                  <div className="rounded-xl bg-white/15 p-3 text-sm">🚛 Collector on the way</div>
                  <div className="rounded-xl bg-white/15 p-3 text-sm">💸 Withdraw to bank</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For businesses & impact */}
      <section className="bg-[#06331d] py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-start gap-12 md:grid-cols-2">
            <div>
              <span className="text-sm font-bold uppercase tracking-wide text-[#7ed957]">For businesses</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Buy recycled. Build sustainably.</h2>
              <p className="mt-4 text-lg text-white/85">
                We supply clean, consistently graded recycled materials — crushed and pelletized plastics, baled PET and more — to manufacturers who want a reliable, traceable, locally-sourced supply.
              </p>
              <a href="#contact" className="mt-8 inline-block rounded-xl bg-[#7ed957] px-6 py-3.5 text-base font-bold text-[#06331d] hover:opacity-90">Talk to our team</a>
            </div>
            <div className="grid gap-4">
              {IMPACT.map((i) => (
                <div key={i.title} className="flex gap-4 rounded-2xl bg-white/5 p-5">
                  <span className="text-3xl">{i.icon}</span>
                  <div>
                    <h3 className="font-bold">{i.title}</h3>
                    <p className="mt-1 text-sm text-white/75">{i.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-20">
        <div className="mx-auto max-w-4xl rounded-3xl border border-black/5 bg-[#f4f7f5] px-8 py-14 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Let's build a cleaner future together</h2>
          <p className="mt-4 text-lg text-slate-600">Sell your recyclables, buy recycled materials, or partner with us. We'd love to hear from you.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={`tel:${PHONE}`} className="rounded-xl bg-[#008037] px-6 py-3.5 text-base font-bold text-white hover:bg-[#006b2e]">Call {PHONE}</a>
            <a href={`mailto:${EMAIL}`} className="rounded-xl border border-slate-300 px-6 py-3.5 text-base font-bold text-slate-700 hover:bg-white">Email us</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-6 w-6 object-contain" />
            <span className="font-semibold text-slate-700">Zyntomax Ventures Limited</span>
          </span>
          <span>Lagos, Nigeria · {PHONE}</span>
          <span>© {new Date().getFullYear()} Zyntomax Ventures Limited</span>
        </div>
      </footer>
    </main>
  );
}
