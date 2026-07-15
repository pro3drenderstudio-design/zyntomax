"use server";

import { redirect } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: "Enter your phone number and password." };
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { roles: true },
  });

  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    return { error: "Invalid phone number or password." };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid phone number or password." };
  }

  await createSession({
    userId: user.id,
    name: user.name,
    roles: user.roles.map((r) => ({ role: r.role, siteId: r.siteId })),
  });

  redirect("/");
}
