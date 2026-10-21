"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canApproveMinutes, canEdit, requireUser, type CurrentUser } from "@/lib/authz";
import { parseDate, parseLocalDateTime } from "@/lib/format";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;

async function loadEditable(meetingId: string, user: CurrentUser) {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, include: { minutes: true } });
  if (!meeting || !canEdit(user, meeting.directorateId)) notFound();
  return meeting;
}

async function ensureMinutes(meetingId: string) {
  return db.minutes.upsert({ where: { meetingId }, create: { meetingId }, update: {} });
}

/** Ata aprovada só volta a ser editada criando nova revisão (status volta a rascunho). */
async function assertMinutesEditable(meetingId: string) {
  const m = await ensureMinutes(meetingId);
  if (m.status === "APROVADA") {
    await db.minutes.update({ where: { id: m.id }, data: { status: "RASCUNHO" } });
  }
  return m;
}

const meetingSchema = z.object({
  title: z.string().min(2, "Informe o título"),
  type: z.string().min(1),
  date: z.string().min(1, "Informe a data"),
  location: z.string().optional(),
  directorateId: z.string().optional(),
});

export async function createMeeting(fd: FormData) {
  const user = await requireUser();
  const data = meetingSchema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  const meeting = await db.meeting.create({
    data: {
      title: data.title,
      type: data.type,
      date: parseLocalDateTime(data.date),
      location: data.location || null,
      directorateId,
      createdById: user.id,
      minutes: { create: {} },
    },
  });
  await audit({ actorId: user.id, action: "meeting.create", entityType: "Meeting", entityId: meeting.id, summary: `Criou a reunião "${meeting.title}"` });
  redirect(`/reunioes/${meeting.id}`);
}

export async function updateMeeting(meetingId: string, fd: FormData) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const data = meetingSchema.parse(Object.fromEntries(fd));
  const directorateId = data.directorateId || null;
  if (!canEdit(user, directorateId)) notFound();
  const status = z.enum(["AGENDADA", "REALIZADA", "CANCELADA"]).parse(str(fd, "status") || "AGENDADA");
  await db.meeting.update({
    where: { id: meetingId },
    data: { title: data.title, type: data.type, date: parseLocalDateTime(data.date), location: data.location || null, directorateId, status },
  });
  await audit({ actorId: user.id, action: "meeting.update", entityType: "Meeting", entityId: meetingId, summary: `Atualizou dados da reunião "${data.title}"` });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function addParticipant(meetingId: string, fd: FormData) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const userId = opt(fd, "userId");
  let name = str(fd, "name");
  if (userId) {
    const u = await db.user.findUnique({ where: { id: userId } });
    name = name || u?.name || u?.email || "";
  }
  if (!name) return;
  await db.meetingParticipant.create({ data: { meetingId, userId, name, role: opt(fd, "role") } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function removeParticipant(meetingId: string, participantId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  await db.meetingParticipant.delete({ where: { id: participantId, meetingId } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function togglePresence(meetingId: string, participantId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const p = await db.meetingParticipant.findUniqueOrThrow({ where: { id: participantId, meetingId } });
  await db.meetingParticipant.update({ where: { id: p.id }, data: { present: !p.present } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function saveMinutes(meetingId: string, fd: FormData) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const m = await assertMinutesEditable(meetingId);
  await db.minutes.update({
    where: { id: m.id },
    data: {
      agenda: str(fd, "agenda"),
      discussions: str(fd, "discussions"),
      generalTopics: str(fd, "generalTopics"),
      closing: str(fd, "closing"),
    },
  });
  await audit({ actorId: user.id, action: "minutes.save", entityType: "Meeting", entityId: meetingId, summary: "Editou o texto da ata" });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function addDecision(meetingId: string, fd: FormData) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const text = str(fd, "text");
  if (!text) return;
  const m = await assertMinutesEditable(meetingId);
  const status = str(fd, "status") === "PENDENTE" ? "PENDENTE" : "DECIDIDA";
  await db.decision.create({ data: { minutesId: m.id, text, status } });
  await audit({ actorId: user.id, action: "decision.create", entityType: "Meeting", entityId: meetingId, summary: `Registrou ${status === "PENDENTE" ? "decisão pendente" : "decisão"}: ${text.slice(0, 80)}` });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function toggleDecision(meetingId: string, decisionId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const m = await assertMinutesEditable(meetingId);
  const d = await db.decision.findUniqueOrThrow({ where: { id: decisionId, minutesId: m.id } });
  await db.decision.update({ where: { id: d.id }, data: { status: d.status === "PENDENTE" ? "DECIDIDA" : "PENDENTE" } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function deleteDecision(meetingId: string, decisionId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const m = await assertMinutesEditable(meetingId);
  await db.decision.delete({ where: { id: decisionId, minutesId: m.id } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function addReferral(meetingId: string, fd: FormData) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const text = str(fd, "text");
  if (!text) return;
  const m = await assertMinutesEditable(meetingId);
  await db.referral.create({ data: { minutesId: m.id, text, ownerName: opt(fd, "ownerName"), dueDate: parseDate(fd.get("dueDate")) } });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function deleteReferral(meetingId: string, referralId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const m = await assertMinutesEditable(meetingId);
  await db.referral.deleteMany({ where: { id: referralId, minutesId: m.id, actionId: null } });
  revalidatePath(`/reunioes/${meetingId}`);
}

/** Encaminhamento → ação no plano de ação (origem = reunião). */
export async function convertReferral(meetingId: string, referralId: string, fd: FormData) {
  const user = await requireUser();
  const meeting = await loadEditable(meetingId, user);
  const ref = await db.referral.findUniqueOrThrow({ where: { id: referralId, minutesId: meeting.minutes!.id } });
  if (ref.actionId) return;
  const ownerId = opt(fd, "ownerId");
  const priority = z.enum(["BAIXA", "MEDIA", "ALTA"]).parse(str(fd, "priority") || "MEDIA");
  const action = await db.actionItem.create({
    data: {
      title: ref.text.length > 140 ? `${ref.text.slice(0, 137)}…` : ref.text,
      description: ref.text.length > 140 ? ref.text : null,
      dueDate: parseDate(fd.get("dueDate")) ?? ref.dueDate,
      ownerId,
      priority,
      directorateId: meeting.directorateId,
      meetingId,
      createdById: user.id,
    },
  });
  await db.referral.update({ where: { id: ref.id }, data: { actionId: action.id } });
  await audit({ actorId: user.id, action: "action.create", entityType: "ActionItem", entityId: action.id, summary: `Converteu encaminhamento da reunião "${meeting.title}" em ação` });
  revalidatePath(`/reunioes/${meetingId}`);
}

export async function submitMinutesForReview(meetingId: string) {
  const user = await requireUser();
  await loadEditable(meetingId, user);
  const m = await ensureMinutes(meetingId);
  await db.minutes.update({ where: { id: m.id }, data: { status: "EM_REVISAO" } });
  await audit({ actorId: user.id, action: "minutes.review", entityType: "Meeting", entityId: meetingId, summary: "Enviou a ata para revisão" });
  revalidatePath(`/reunioes/${meetingId}`);
}

/** Aprova e congela uma versão (snapshot) da ata. */
export async function approveMinutes(meetingId: string) {
  const user = await requireUser();
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: { participants: true, minutes: { include: { decisions: true, referrals: true, versions: true } } },
  });
  if (!meeting?.minutes || !canApproveMinutes(user, meeting.directorateId)) notFound();
  const m = meeting.minutes;
  const number = (m.versions.reduce((n, v) => Math.max(n, v.number), 0) || 0) + 1;
  const snapshot = {
    meeting: { title: meeting.title, type: meeting.type, date: meeting.date.toISOString(), location: meeting.location },
    participants: meeting.participants.map((p) => ({ name: p.name, role: p.role, present: p.present })),
    agenda: m.agenda,
    discussions: m.discussions,
    generalTopics: m.generalTopics,
    decisions: m.decisions.map((d) => ({ text: d.text, status: d.status })),
    referrals: m.referrals.map((r) => ({ text: r.text, ownerName: r.ownerName, dueDate: r.dueDate?.toISOString() ?? null })),
    closing: m.closing,
  };
  await db.$transaction([
    db.minutesVersion.create({ data: { minutesId: m.id, number, snapshot, approvedById: user.id } }),
    db.minutes.update({ where: { id: m.id }, data: { status: "APROVADA" } }),
    db.meeting.update({ where: { id: meetingId }, data: { status: "REALIZADA" } }),
  ]);
  await audit({ actorId: user.id, action: "minutes.approve", entityType: "Meeting", entityId: meetingId, summary: `Aprovou a ata de "${meeting.title}" (versão ${number})` });
  revalidatePath(`/reunioes/${meetingId}`);
}
