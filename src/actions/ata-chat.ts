"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, requireUser } from "@/lib/authz";
import { chatAta, type Operation } from "@/lib/ata-ai";
import { timed } from "@/lib/access-log";

export type ChatState = { error?: string } | null;

const norm = (s: string) => s.trim().toLowerCase();
const replaceName = (text: string, from: string, to: string) =>
  text.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), to);
const parseDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00-03:00`) : null);

export async function askAta(meetingId: string, _prev: ChatState, fd: FormData): Promise<ChatState> {
  const user = await requireUser();
  const prompt = String(fd.get("prompt") ?? "").trim();
  if (!prompt) return { error: "Escreva o que você quer que o assistente faça." };
  if (prompt.length > 4000) return { error: "Pedido longo demais (máximo 4.000 caracteres)." };

  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: {
      directorate: true,
      participants: true,
      minutes: { include: { decisions: { orderBy: { createdAt: "asc" } }, referrals: { orderBy: { createdAt: "asc" } }, messages: { orderBy: { createdAt: "desc" }, take: 20 } } },
    },
  });
  if (!meeting || !canEdit(user, meeting.directorateId)) notFound();
  const minutes = meeting.minutes ?? (await db.minutes.create({ data: { meetingId }, include: { decisions: true, referrals: true, messages: true } }));

  let result;
  try {
    result = await timed("minutes.chat", user.id, () =>
      chatAta({
        title: meeting.title, type: meeting.type, date: meeting.date, location: meeting.location, directorate: meeting.directorate?.name ?? null,
        participants: meeting.participants.map((p) => ({ name: p.name, role: p.role })),
        transcript: minutes.transcript,
        minutes: { agenda: minutes.agenda, discussions: minutes.discussions, generalTopics: minutes.generalTopics, closing: minutes.closing },
        decisions: minutes.decisions.map((d) => ({ id: d.id, text: d.text, status: d.status })),
        referrals: minutes.referrals.map((r) => ({ id: r.id, text: r.text, ownerName: r.ownerName, dueDate: r.dueDate?.toISOString().slice(0, 10) ?? null })),
        history: [...minutes.messages].reverse().map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.role === "USER" ? m.content : JSON.stringify({ reply: m.content, operations: m.operations ?? [] }) })),
        prompt,
      }),
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "Chave da API do Claude inválida." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Limite de uso da API do Claude atingido. Tente em alguns minutos." };
    if (e instanceof Anthropic.APIError) return { error: `Erro na API do Claude (${e.status}): ${e.message}` };
    return { error: e instanceof Error ? e.message : "Falha no assistente." };
  }

  const applied: string[] = [];
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  // nomes renomeados nesta mesma resposta (para achar o participante pelo nome novo)
  const renamed = new Map<string, string>();
  const findParticipant = (name: string) =>
    meeting.participants.find((x) => norm(x.name) === norm(name) || norm(renamed.get(norm(x.name)) ?? "") === norm(name));
  const fields = { agenda: minutes.agenda, discussions: minutes.discussions, generalTopics: minutes.generalTopics, closing: minutes.closing };
  let fieldsChanged = false;

  for (const op of result.operations as Operation[]) {
    switch (op.type) {
      case "set_field":
        fields[op.field] = op.value; fieldsChanged = true;
        applied.push(`seção "${op.field}" reescrita`); break;
      case "rename_participant": {
        const matches = meeting.participants.filter((p) => norm(p.name) === norm(op.from));
        for (const p of matches) { ops.push(db.meetingParticipant.update({ where: { id: p.id }, data: { name: op.to } })); renamed.set(norm(p.name), op.to); }
        for (const k of Object.keys(fields) as (keyof typeof fields)[]) { const nv = replaceName(fields[k], op.from, op.to); if (nv !== fields[k]) { fields[k] = nv; fieldsChanged = true; } }
        for (const d of minutes.decisions) { const nv = replaceName(d.text, op.from, op.to); if (nv !== d.text) ops.push(db.decision.update({ where: { id: d.id }, data: { text: nv } })); }
        for (const r of minutes.referrals) {
          const nt = replaceName(r.text, op.from, op.to); const no = r.ownerName ? replaceName(r.ownerName, op.from, op.to) : r.ownerName;
          if (nt !== r.text || no !== r.ownerName) ops.push(db.referral.update({ where: { id: r.id }, data: { text: nt, ownerName: no } }));
        }
        applied.push(`"${op.from}" → "${op.to}"`); break;
      }
      case "set_participant_role": {
        const p = findParticipant(op.name);
        if (p) { ops.push(db.meetingParticipant.update({ where: { id: p.id }, data: { role: op.role } })); applied.push(`papel de ${op.name}: ${op.role}`); }
        break;
      }
      case "add_participant":
        if (!findParticipant(op.name)) { ops.push(db.meetingParticipant.create({ data: { meetingId, name: op.name.trim(), role: op.role } })); applied.push(`participante ${op.name}`); }
        break;
      case "add_decision":
        ops.push(db.decision.create({ data: { minutesId: minutes.id, text: op.text, status: op.status } })); applied.push("nova decisão"); break;
      case "update_decision":
        if (minutes.decisions.some((d) => d.id === op.id)) { ops.push(db.decision.update({ where: { id: op.id }, data: { ...(op.text ? { text: op.text } : {}), ...(op.status ? { status: op.status } : {}) } })); applied.push("decisão atualizada"); }
        break;
      case "delete_decision":
        if (minutes.decisions.some((d) => d.id === op.id)) { ops.push(db.decision.delete({ where: { id: op.id } })); applied.push("decisão removida"); }
        break;
      case "add_referral":
        ops.push(db.referral.create({ data: { minutesId: minutes.id, text: op.text, ownerName: op.ownerName, dueDate: parseDate(op.dueDate) } })); applied.push("novo encaminhamento"); break;
      case "update_referral": {
        const r = minutes.referrals.find((x) => x.id === op.id);
        if (r) { ops.push(db.referral.update({ where: { id: r.id }, data: { ...(op.text ? { text: op.text } : {}), ...(op.ownerName !== null ? { ownerName: op.ownerName } : {}), ...(op.dueDate !== null ? { dueDate: parseDate(op.dueDate) } : {}) } })); applied.push("encaminhamento atualizado"); }
        break;
      }
      case "delete_referral": {
        const r = minutes.referrals.find((x) => x.id === op.id);
        if (r && !r.actionId) { ops.push(db.referral.delete({ where: { id: r.id } })); applied.push("encaminhamento removido"); }
        break;
      }
    }
  }
  if (fieldsChanged || applied.length) {
    ops.push(db.minutes.update({
      where: { id: minutes.id },
      data: { ...fields, status: minutes.status === "APROVADA" ? "RASCUNHO" : minutes.status, aiCostCents: { increment: result.costCents } },
    }));
  } else {
    ops.push(db.minutes.update({ where: { id: minutes.id }, data: { aiCostCents: { increment: result.costCents } } }));
  }
  ops.push(db.minutesMessage.create({ data: { minutesId: minutes.id, role: "USER", content: prompt, authorId: user.id } }));
  ops.push(db.minutesMessage.create({
    data: { minutesId: minutes.id, role: "ASSISTANT", content: result.reply, operations: result.operations as Prisma.InputJsonValue, costCents: result.costCents },
  }));
  await db.$transaction(ops);

  await audit({
    actorId: user.id,
    action: "minutes.chat",
    entityType: "Meeting",
    entityId: meetingId,
    summary: applied.length ? `Assistente da ata aplicou: ${applied.join(", ")}` : `Consultou o assistente da ata: "${prompt.slice(0, 80)}"`,
    data: { prompt, applied, usage: result.usage, costCents: result.costCents },
  });
  revalidatePath(`/reunioes/${meetingId}`);
  return null;
}

export async function clearAtaChat(meetingId: string) {
  const user = await requireUser();
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, include: { minutes: true } });
  if (!meeting?.minutes || !canEdit(user, meeting.directorateId)) notFound();
  await db.minutesMessage.deleteMany({ where: { minutesId: meeting.minutes.id } });
  revalidatePath(`/reunioes/${meetingId}`);
}
