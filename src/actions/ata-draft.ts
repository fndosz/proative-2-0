"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, requireUser } from "@/lib/authz";
import { generateAta } from "@/lib/ata-ai";

export type ActionState = { ok?: string; error?: string } | null;

async function loadEditable(meetingId: string) {
  const user = await requireUser();
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: { directorate: true, participants: true, minutes: { include: { decisions: true, referrals: true } } },
  });
  if (!meeting || !canEdit(user, meeting.directorateId)) notFound();
  const minutes = meeting.minutes ?? (await db.minutes.create({ data: { meetingId }, include: { decisions: true, referrals: true } }));
  return { user, meeting, minutes };
}

/** Rascunho livre / transcrição: só texto, guardado para histórico. */
export async function saveTranscript(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, minutes } = await loadEditable(meetingId);
  const transcript = String(fd.get("transcript") ?? "");
  await db.minutes.update({ where: { id: minutes.id }, data: { transcript, transcriptUpdatedAt: new Date() } });
  await audit({
    actorId: user.id,
    action: "minutes.transcript",
    entityType: "Meeting",
    entityId: meetingId,
    summary: `Salvou o rascunho/transcrição da ata (${transcript.length.toLocaleString("pt-BR")} caracteres)`,
  });
  revalidatePath(`/reunioes/${meetingId}`);
  return { ok: "Rascunho salvo." };
}

/** Transcrição → ata no modelo Proative, pelo Claude. */
export async function generateAtaFromTranscript(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, meeting, minutes } = await loadEditable(meetingId);
  const transcript = String(fd.get("transcript") ?? minutes.transcript ?? "").trim();
  if (transcript.length < 40) return { error: "Cole a transcrição ou o rascunho da reunião antes de gerar a ata." };
  const overwrite = fd.get("overwrite") === "on";

  // guarda o rascunho mais recente antes de gerar
  if (transcript !== minutes.transcript) {
    await db.minutes.update({ where: { id: minutes.id }, data: { transcript, transcriptUpdatedAt: new Date() } });
  }

  let result;
  try {
    result = await generateAta({
      title: meeting.title,
      type: meeting.type,
      date: meeting.date,
      location: meeting.location,
      directorate: meeting.directorate?.name ?? null,
      participants: meeting.participants.map((p) => ({ name: p.name, role: p.role })),
      transcript,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "Chave da API do Claude inválida. Verifique ANTHROPIC_API_KEY na Vercel." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Limite de uso da API do Claude atingido. Tente novamente em alguns minutos." };
    if (e instanceof Anthropic.APIError) return { error: `Erro na API do Claude (${e.status}): ${e.message}` };
    return { error: e instanceof Error ? e.message : "Falha ao gerar a ata." };
  }
  const { draft } = result;

  const keep = (current: string, next: string) => (overwrite || !current.trim() ? next : current);
  const unclearNote = draft.unclear.length ? `\n\nPontos a confirmar:\n${draft.unclear.map((u) => `• ${u} [a confirmar]`).join("\n")}` : "";

  const existingDecisions = new Set(minutes.decisions.map((d) => d.text.trim().toLowerCase()));
  const existingReferrals = new Set(minutes.referrals.map((r) => r.text.trim().toLowerCase()));
  const newDecisions = draft.decisions.filter((d) => !existingDecisions.has(d.text.trim().toLowerCase()));
  const newReferrals = draft.referrals.filter((r) => !existingReferrals.has(r.text.trim().toLowerCase()));

  const existingNames = new Set(meeting.participants.map((p) => p.name.trim().toLowerCase()));
  const newParticipants = draft.participantsDetected.filter((n) => n.trim() && !existingNames.has(n.trim().toLowerCase()));

  await db.$transaction([
    db.minutes.update({
      where: { id: minutes.id },
      data: {
        agenda: keep(minutes.agenda, draft.agenda),
        discussions: keep(minutes.discussions, draft.discussions + (overwrite || !minutes.discussions.trim() ? unclearNote : "")),
        generalTopics: keep(minutes.generalTopics, draft.generalTopics),
        closing: keep(minutes.closing, draft.closing),
        status: minutes.status === "APROVADA" ? "RASCUNHO" : minutes.status,
        aiGeneratedAt: new Date(),
        aiModel: result.model,
        aiCostCents: { increment: result.costCents },
      },
    }),
    db.decision.createMany({ data: newDecisions.map((d) => ({ minutesId: minutes.id, text: d.text, status: d.status })) }),
    db.referral.createMany({
      data: newReferrals.map((r) => ({
        minutesId: minutes.id,
        text: r.text,
        ownerName: r.ownerName,
        dueDate: r.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) ? new Date(`${r.dueDate}T12:00:00-03:00`) : null,
      })),
    }),
    db.meetingParticipant.createMany({ data: newParticipants.map((name) => ({ meetingId, name: name.trim(), role: "[a confirmar]" })) }),
  ]);

  await audit({
    actorId: user.id,
    action: "minutes.ai",
    entityType: "Meeting",
    entityId: meetingId,
    summary: `Gerou rascunho da ata com o Claude (${newDecisions.length} decisões, ${newReferrals.length} encaminhamentos${newParticipants.length ? `, ${newParticipants.length} participantes detectados` : ""})`,
    data: { model: result.model, usage: result.usage, costCents: result.costCents, overwrite, unclear: draft.unclear },
  });
  revalidatePath(`/reunioes/${meetingId}`);
  return {
    ok: `Ata gerada: ${newDecisions.length} decisão(ões), ${newReferrals.length} encaminhamento(s)${newParticipants.length ? `, ${newParticipants.length} participante(s) detectado(s)` : ""}${draft.unclear.length ? ` · ${draft.unclear.length} ponto(s) marcados [a confirmar]` : ""}. Revise o texto abaixo antes de aprovar.`,
  };
}

/** Importa um documento Word (.docx): o texto vira rascunho/transcrição e o arquivo fica na biblioteca, vinculado à reunião. */
export async function importWord(meetingId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, meeting, minutes } = await loadEditable(meetingId);
  const file = fd.get("docx");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo .docx para importar." };
  if (!/\.docx$/i.test(file.name)) return { error: "Formato aceito: Word (.docx). Para .doc antigo, salve como .docx antes." };
  if (file.size > 20 * 1024 * 1024) return { error: "Arquivo acima de 20 MB." };

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer })).value.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return { error: "Não foi possível ler o arquivo. Confirme que é um .docx válido." };
  }
  if (!text) return { error: "O documento não tem texto legível (só imagens?)." };

  const mode = String(fd.get("importMode") ?? "append");
  const transcript = mode === "replace" || !minutes.transcript.trim() ? text : `${minutes.transcript.trimEnd()}\n\n--- Importado de ${file.name} ---\n${text}`;

  const { saveFile } = await import("@/lib/storage");
  const pathname = await saveFile(`reunioes/${meetingId}/docs`, file);
  await db.$transaction([
    db.minutes.update({ where: { id: minutes.id }, data: { transcript, transcriptUpdatedAt: new Date() } }),
    db.document.create({
      data: {
        title: file.name.replace(/\.docx$/i, ""),
        description: "Importado como rascunho da ata",
        tags: ["ata", "importado"],
        directorateId: meeting.directorateId,
        createdById: user.id,
        versions: { create: { number: 1, fileName: file.name, mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: file.size, blobPathname: pathname, uploadedById: user.id } },
        links: { create: { meetingId } },
      },
    }),
  ]);
  await audit({ actorId: user.id, action: "minutes.importWord", entityType: "Meeting", entityId: meetingId, summary: `Importou "${file.name}" para o rascunho da ata (${text.length.toLocaleString("pt-BR")} caracteres)` });
  revalidatePath(`/reunioes/${meetingId}`);
  return { ok: `"${file.name}" importado: ${text.length.toLocaleString("pt-BR")} caracteres no rascunho. Revise e clique em "Gerar ata com IA" se quiser formatar.` };
}
