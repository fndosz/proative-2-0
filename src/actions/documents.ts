"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, documentScope, isAdmin, requireUser } from "@/lib/authz";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 50 * 1024 * 1024;

function parseTags(v: FormDataEntryValue | null) {
  return String(v ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function getFile(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo.");
  if (file.size > MAX_BYTES) throw new Error("Arquivo acima de 50 MB.");
  return file;
}

export async function createDocument(fd: FormData) {
  const user = await requireUser();
  const directorateId = String(fd.get("directorateId") ?? "") || null;
  if (!canEdit(user, directorateId)) notFound();
  const file = getFile(fd);
  const title = String(fd.get("title") ?? "").trim() || file.name;
  const pathname = await saveFile(`biblioteca/${directorateId ?? "geral"}`, file);
  const meetingId = String(fd.get("meetingId") ?? "") || null;
  const doc = await db.document.create({
    data: {
      title,
      description: String(fd.get("description") ?? "").trim() || null,
      tags: parseTags(fd.get("tags")),
      directorateId,
      restricted: fd.get("restricted") === "on",
      createdById: user.id,
      versions: { create: { number: 1, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, blobPathname: pathname, uploadedById: user.id } },
      links: meetingId ? { create: { meetingId } } : undefined,
    },
  });
  await audit({ actorId: user.id, action: "document.create", entityType: "Document", entityId: doc.id, summary: `Enviou o documento "${title}"` });
  redirect(`/biblioteca/${doc.id}`);
}

async function loadEditable(documentId: string) {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id: documentId, ...documentScope(user) }, include: { versions: true } });
  if (!doc || !canEdit(user, doc.directorateId)) notFound();
  return { user, doc };
}

export async function addVersion(documentId: string, fd: FormData) {
  const { user, doc } = await loadEditable(documentId);
  const file = getFile(fd);
  const number = doc.versions.reduce((n, v) => Math.max(n, v.number), 0) + 1;
  const pathname = await saveFile(`biblioteca/${doc.directorateId ?? "geral"}`, file);
  await db.documentVersion.create({
    data: { documentId, number, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size, blobPathname: pathname, uploadedById: user.id },
  });
  await db.document.update({ where: { id: documentId }, data: { updatedAt: new Date() } });
  await audit({ actorId: user.id, action: "document.version", entityType: "Document", entityId: documentId, summary: `Enviou a versão ${number} de "${doc.title}"` });
  revalidatePath(`/biblioteca/${documentId}`);
}

export async function updateDocument(documentId: string, fd: FormData) {
  const { user, doc } = await loadEditable(documentId);
  await db.document.update({
    where: { id: documentId },
    data: {
      title: String(fd.get("title") ?? "").trim() || doc.title,
      description: String(fd.get("description") ?? "").trim() || null,
      tags: parseTags(fd.get("tags")),
      restricted: fd.get("restricted") === "on",
    },
  });
  await audit({ actorId: user.id, action: "document.update", entityType: "Document", entityId: documentId, summary: `Atualizou dados de "${doc.title}"` });
  revalidatePath(`/biblioteca/${documentId}`);
}

export async function setDocumentAccess(documentId: string, fd: FormData) {
  const { user, doc } = await loadEditable(documentId);
  if (!isAdmin(user) && doc.createdById !== user.id) notFound();
  const userIds = fd.getAll("userIds").map(String);
  await db.$transaction([
    db.documentAccess.deleteMany({ where: { documentId } }),
    db.documentAccess.createMany({ data: userIds.map((userId) => ({ documentId, userId })) }),
  ]);
  await audit({ actorId: user.id, action: "document.access", entityType: "Document", entityId: documentId, summary: `Alterou quem pode ver "${doc.title}" (${userIds.length} pessoa(s))` });
  revalidatePath(`/biblioteca/${documentId}`);
}

export async function linkDocument(documentId: string, fd: FormData) {
  const { user, doc } = await loadEditable(documentId);
  const meetingId = String(fd.get("meetingId") ?? "") || null;
  const actionId = String(fd.get("actionId") ?? "") || null;
  if (!meetingId && !actionId) return;
  await db.documentLink.create({ data: { documentId, meetingId, actionId } });
  await audit({ actorId: user.id, action: "document.link", entityType: "Document", entityId: documentId, summary: `Vinculou "${doc.title}" a ${meetingId ? "uma reunião" : "uma ação"}` });
  revalidatePath(`/biblioteca/${documentId}`);
}

export async function unlinkDocument(documentId: string, linkId: string) {
  await loadEditable(documentId);
  await db.documentLink.delete({ where: { id: linkId, documentId } });
  revalidatePath(`/biblioteca/${documentId}`);
}
