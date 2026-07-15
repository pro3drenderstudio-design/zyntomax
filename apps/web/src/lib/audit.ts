import { prisma } from "@zyntomax/db";

export async function audit(params: {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      before: params.before as never,
      after: params.after as never,
    },
  });
}
