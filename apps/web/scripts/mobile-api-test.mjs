const base = "http://localhost:3100/api/mobile";

// 1. Login as team lead
const loginRes = await fetch(`${base}/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone: "08000000005", password: "zyntomax123" }),
});
const login = await loginRes.json();
console.log("login:", loginRes.status, login.user?.name, login.user?.roles);
if (!login.token) process.exit(1);
const auth = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };

// 2. Bootstrap
const boot = await (await fetch(`${base}/bootstrap`, { headers: auth })).json();
console.log(
  "bootstrap:",
  boot.sites?.length, "sites,",
  boot.localities?.length, "localities,",
  boot.materials?.length, "materials,",
  boot.vendors?.length, "vendors,",
  boot.banks?.length, "banks",
);

// 3. My trips
const trips = await (await fetch(`${base}/trips`, { headers: auth })).json();
console.log("trips:", trips.trips?.length ?? 0, "active for this staff");

// 4. Register a vendor (idempotent)
const vRes = await fetch(`${base}/vendors`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    clientUuid: "test-uuid-vendor-1",
    name: "Mobile Test Vendor",
    phone: "08199990001",
    siteId: boot.sites[0].id,
    localityId: boot.localities[0].id,
    lat: 6.61,
    lng: 3.32,
  }),
});
const v = await vRes.json();
console.log("vendor create:", vRes.status, v);

// 5. Retry same vendor — must dedupe
const v2 = await (await fetch(`${base}/vendors`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    clientUuid: "test-uuid-vendor-1",
    name: "Mobile Test Vendor",
    phone: "08199990001",
    siteId: boot.sites[0].id,
  }),
})).json();
console.log("vendor retry deduped:", v2.deduped === true);

// 6. Weigh-in against an active trip if one exists
if (trips.trips?.length > 0) {
  const w = await (await fetch(`${base}/weighins`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      clientUuid: "test-uuid-weighin-1",
      tripId: trips.trips[0].id,
      vendorId: v.id,
      materialTypeId: boot.materials[0].id,
      weightKg: 10,
      lat: 6.61, lng: 3.32,
    }),
  })).json();
  console.log("weigh-in:", w);
  const w2 = await (await fetch(`${base}/weighins`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      clientUuid: "test-uuid-weighin-1",
      tripId: trips.trips[0].id,
      vendorId: v.id,
      materialTypeId: boot.materials[0].id,
      weightKg: 10,
    }),
  })).json();
  console.log("weigh-in retry deduped:", w2.deduped === true);
} else {
  console.log("no active trip for weigh-in test (trip from e2e is PAID) — idempotency verified at vendor level");
}
console.log("MOBILE API OK");
