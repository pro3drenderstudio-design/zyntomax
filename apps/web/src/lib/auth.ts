import { redirect } from "next/navigation";
import type { RoleName } from "@zyntomax/db";
import { getSession, type Session } from "./session";

/** Roles that can see everything in the admin. */
const GLOBAL_ROLES: RoleName[] = ["SUPER_ADMIN"];

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function hasRole(
  session: Session,
  roles: RoleName[],
  siteId?: string,
): boolean {
  return session.roles.some((r) => {
    if (GLOBAL_ROLES.includes(r.role)) return true;
    if (!roles.includes(r.role)) return false;
    // null siteId on the grant = global grant for that role
    return r.siteId === null || siteId === undefined || r.siteId === siteId;
  });
}

/** Server-action / page guard. Redirects to dashboard when the role check fails. */
export async function requireRole(
  roles: RoleName[],
  siteId?: string,
): Promise<Session> {
  const session = await requireSession();
  if (!hasRole(session, roles, siteId)) redirect("/dashboard");
  return session;
}

/** Site ids the session may access; null = all sites. */
export function accessibleSiteIds(session: Session): string[] | null {
  if (session.roles.some((r) => GLOBAL_ROLES.includes(r.role) || r.siteId === null)) {
    return null;
  }
  return [...new Set(session.roles.flatMap((r) => (r.siteId ? [r.siteId] : [])))];
}
