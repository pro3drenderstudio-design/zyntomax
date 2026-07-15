import { SignJWT } from "jose";
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const secret = env.match(/AUTH_SECRET="([^"]+)"/)[1];

const adminId = process.env.ADMIN_ID;
if (!adminId) throw new Error("Set ADMIN_ID env var");

const token = await new SignJWT({
  userId: adminId,
  name: "Super Admin",
  roles: [{ role: "SUPER_ADMIN", siteId: null }],
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

const res = await fetch("http://localhost:3100/api/dev/e2e", {
  headers: { cookie: `zyntomax_session=${token}` },
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
process.exit(body.ok ? 0 : 1);
