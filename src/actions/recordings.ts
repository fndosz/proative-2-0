"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, requireUser } from "@/lib/authz";
import { saveFile } from "@/lib/storage";

const AUDIO = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/wave"];
const RETENTION_DAYS = Number(process.env.AUDIO_RETENTION_DAYS ?? 180);

/**
 * Etapa 1 do módulo Plaud: recebe o áudio bruto e guarda na pasta da reunião.
 * Transcrição (speech-to-text) e redação com o Claude entram quando o provedor e a chave forem definidos.
 */
export async function uploadRecording(meetingId: string, fd: FormData) {
  const user = await requireUser();
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !canEdit(user, meeting.directorateId)) notFound();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione o áudio exportado do Plaud.");
  const okType = AUDIO.includes(file.type) || /\.(mp3|m4a|wav)$/i.test(file.name);
  if (!okType) throw new Error("Formato aceito: MP3, M4A ou WAV.");
  const pathname = await saveFile(`reunioes/${meetingId}/audio`, file);
  const rec = await db.recording.create({
    data: {
      meetingId,
      fileName: file.name,
      mimeType: file.type || "audio/mpeg",
      size: file.size,
      blobPathname: pathname,
      retainUntil: new Date(Date.now() + RETENTION_DAYS * 86400_000),
    },
  });
  await audit({ actorId: user.id, action: "recording.upload", entityType: "Meeting", entityId: meetingId, summary: `Enviou a gravação "${file.name}"`, data: { recordingId: rec.id } });
  revalidatePath(`/reunioes/${meetingId}`);
}
