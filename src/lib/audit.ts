import { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  data?: Prisma.InputJsonValue;
}) {
  await db.auditEvent.create({ data: params });
}
