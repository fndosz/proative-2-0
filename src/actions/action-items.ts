"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, canView, requireUser } from "@/lib/authz";
import { ACTION_STATUS_LABEL, parseDate } from "@/lib/format";
import { saveFile } from "@/lib/storage";

const statusEnum = z.enum(["NAO_INICIADA", "EM_ANDAMENTO", "BLOQUEADA", "CONCLUIDA"]);
const priorityEnum = z.enum(["BAIXA", "MEDIA", "ALTA"]);

const schema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  description: z.string().optional(),
  status: statusEnum.default("NAO_INICIADA"),
  priority: priorityEnum.default("MEDIA"),
  ownerId: z.string().optional(),
  directorateId: z.string().optional(),
});

export async function createAction(fd: FormData) {
  const user = await requireUser();
  const data = schema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  const action = await db.actionItem.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      ownerId: data.ownerId || null,
      directorateId,
      dueDate: parseDate(fd.get("dueDate")),
      createdById: user.id,
      completedAt: data.status === "CONCLUIDA" ? new Date() : null,
    },
  });
  await audit({ actorId: user.id, action: "action.create", entityType: "ActionItem", entityId: action.id, summary: `Criou a ação "${action.title}"` });
  redirect(`/acoes/${action.id}`);
}

async function loadEditable(actionId: string) {
  const user = await requireUser();
  const action = await db.actionItem.findUnique({ where: { id: actionId } });
  if (!action || !canEdit(user, action.directorateId)) notFound();
  return { user, action };
}

export async function updateAction(actionId: string, fd: FormData) {
  const { user, action } = await loadEditable(actionId);
  const data = schema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  await db.actionItem.update({
    where: { id: actionId },
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      ownerId: data.ownerId || null,
      directorateId,
      dueDate: parseDate(fd.get("dueDate")),
      completedAt: data.status === "CONCLUIDA" ? (action.completedAt ?? new Date()) : null,
    },
  });
  const changes: string[] = [];
  if (action.status !== data.status) changes.push(`status → ${ACTION_STATUS_LABEL[data.status]}`);
  await audit({
    actorId: user.id,
    action: "action.update",
    entityType: "ActionItem",
    entityId: actionId,
    summary: `Atualizou a ação "${data.title}"${changes.length ? ` (${changes.join(", ")})` : ""}`,
  });
  revalidatePath(`/acoes/${actionId}`);
  revalidatePath("/acoes");
}

/** Usado pelo Kanban */
export async function setActionStatus(actionId: string, status: string) {
  const { user, action } = await loadEditable(actionId);
  const s = statusEnum.parse(status);
  if (s === action.status) return;
  await db.actionItem.update({
    where: { id: actionId },
    data: { status: s, completedAt: s === "CONCLUIDA" ? new Date() : null },
  });
  await audit({ actorId: user.id, action: "action.status", entityType: "ActionItem", entityId: actionId, summary: `Moveu "${action.title}" para ${ACTION_STATUS_LABEL[s]}` });
  revalidatePath("/acoes");
}

export async function addComment(actionId: string, fd: FormData) {
  const user = await requireUser();
  const action = await db.actionItem.findUnique({ where: { id: actionId } });
  if (!action || !canView(user, action.directorateId) || user.role === "LEITOR") notFound();
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return;
  await db.actionComment.create({ data: { actionId, authorId: user.id, body } });
  await audit({ actorId: user.id, action: "action.comment", entityType: "ActionItem", entityId: actionId, summary: `Comentou em "${action.title}"` });
  revalidatePath(`/acoes/${actionId}`);
}

/** Anexo da ação = documento na biblioteca vinculado à ação. */
export async function attachToAction(actionId: string, fd: FormData) {
  const { user, action } = await loadEditable(actionId);
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const pathname = await saveFile(`acoes/${actionId}`, file);
  const doc = await db.document.create({
    data: {
      title: file.name,
      directorateId: action.directorateId,
      createdById: user.id,
      tags: ["anexo"],
      versions: { create: { number: 1, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, blobPathname: pathname, uploadedById: user.id } },
      links: { create: { actionId } },
    },
  });
  await audit({ actorId: user.id, action: "action.attach", entityType: "ActionItem", entityId: actionId, summary: `Anexou "${file.name}" à ação "${action.title}"`, data: { documentId: doc.id } });
  revalidatePath(`/acoes/${actionId}`);
}
