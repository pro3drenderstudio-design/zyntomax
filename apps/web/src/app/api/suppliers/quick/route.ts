import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { getSession } from "@/lib/session";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Quick-create a supplier (used by the modal on the new-purchase page). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !hasRole(session, ["PURCHASING_MANAGER", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { name, typeId, phone } = (await request.json()) as {
    name?: string;
    typeId?: string;
    phone?: string;
  };
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Enter a supplier name." }, { status: 400 });
  }
  const supplier = await prisma.supplier.create({
    data: { name: name.trim(), typeId: typeId || null, phone: phone || null },
  });
  await audit({
    actorId: session.userId,
    action: "supplier.quick_create",
    entity: "Supplier",
    entityId: supplier.id,
    after: { name: supplier.name },
  });
  return NextResponse.json({ id: supplier.id, name: supplier.name });
}
