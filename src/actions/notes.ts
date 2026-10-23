"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, directorateScope, requireUser } from "@/lib/authz";
import { parseLocalDateTime } from "@/lib/format";

const schema = z.object({
  title: z.string().trim().min(2, "Informe um título"),
  date: z.string().min(1, "Informe a data"),
  directorateId: z.string().optional(),
  participants: z.string().optional(),
  body: z.string().trim().min(1, "Escreva os pontos abordados"),
  tags: z.string().optional(),
});

const parseTags = (v?: string) => (v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20);

export async function createNote(fd: FormData) {
  const user = await requireUser();
  if (user.role === "LEITOR") notFound();
  const data = schema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  const note = await db.note.create({
    data: {
      title: data.title,
      date: parseLocalDateTime(data.date),
      directorateId,
      participants: data.participants?.trim() || null,
      body: data.body,
      tags: parseTags(data.tags),
      createdById: user.id,
    },
  });
  await audit({ actorId: user.id, action: "note.create", entityType: "Note", entityId: note.id, summary: `Criou a anotação "${note.title}"` });
  redirect(`/anotacoes/${note.id}`);
}

async function loadEditable(noteId: string) {
  const user = await requireUser();
  const note = await db.note.findFirst({ where: { id: noteId, ...directorateScope(user) } });
  if (!note || !canEdit(user, note.directorateId)) notFound();
  return { user, note };
}

export async function updateNote(noteId: string, fd: FormData) {
  const { user, note } = await loadEditable(noteId);
  const data = schema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  await db.note.update({
    where: { id: noteId },
    data: { title: data.title, date: parseLocalDateTime(data.date), directorateId, participants: data.participants?.trim() || null, body: data.body, tags: parseTags(data.tags) },
  });
  await audit({ actorId: user.id, action: "note.update", entityType: "Note", entityId: noteId, summary: `Editou a anotação "${note.title}"` });
  revalidatePath(`/anotacoes/${noteId}`);
  revalidatePath("/anotacoes");
}

export async function archiveNote(noteId: string) {
  const { user, note } = await loadEditable(noteId);
  await db.note.update({ where: { id: noteId }, data: { archivedAt: note.archivedAt ? null : new Date() } });
  await audit({ actorId: user.id, action: note.archivedAt ? "note.unarchive" : "note.archive", entityType: "Note", entityId: noteId, summary: `${note.archivedAt ? "Desarquivou" : "Arquivou"} a anotação "${note.title}"` });
  revalidatePath("/anotacoes");
  revalidatePath(`/anotacoes/${noteId}`);
}

export async function deleteNote(noteId: string) {
  const { user, note } = await loadEditable(noteId);
  await db.note.delete({ where: { id: noteId } });
  await audit({ actorId: user.id, action: "note.delete", entityType: "Note", entityId: noteId, summary: `Removeu a anotação "${note.title}"` });
  revalidatePath("/anotacoes");
  redirect("/anotacoes");
}

/** Transforma a anotação em reunião: o texto vira o rascunho da ata (pronto para "Gerar ata com IA"). */
export async function convertNoteToMeeting(noteId: string) {
  const { user, note } = await loadEditable(noteId);
  if (note.meetingId) redirect(`/reunioes/${note.meetingId}`);
  const participants = (note.participants ?? "").split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
  const meeting = await db.meeting.create({
    data: {
      title: note.title,
      type: "Reunião geral",
      date: note.date,
      directorateId: note.directorateId,
      createdById: user.id,
      participants: { create: participants.map((name) => ({ name })) },
      minutes: {
        create: {
          transcript: `${note.participants ? `Participantes: ${note.participants}\n\n` : ""}${note.body}`,
          transcriptUpdatedAt: new Date(),
        },
      },
    },
  });
  await db.note.update({ where: { id: noteId }, data: { meetingId: meeting.id } });
  await audit({ actorId: user.id, action: "note.convert", entityType: "Meeting", entityId: meeting.id, summary: `Converteu a anotação "${note.title}" em reunião` });
  redirect(`/reunioes/${meeting.id}`);
}
