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
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your email or phone and password." };
  }

  const isEmail = identifier.includes("@");
  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: { equals: identifier, mode: "insensitive" } }
      : { phone: identifier },
    include: { roles: true },
  });

  if (!user || !user.passwordHash) {
    return { error: "Invalid credentials." };
  }
  if (user.status !== "ACTIVE") {
    return { error: "This account is not active. Contact your administrator." };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid credentials." };
  }

  await createSession({
    userId: user.id,
    name: user.name,
    roles: user.roles.map((r) => ({ role: r.role, siteId: r.siteId })),
  });

  redirect("/dashboard");
}
