import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 90);

/** Diário (vercel.json): apaga logs de acesso antigos e áudios do Plaud fora do prazo de retenção. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Não autorizado", { status: 401 });
  }
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 86400_000);
  const logs = await db.accessLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  const expired = await db.recording.findMany({ where: { retainUntil: { lt: new Date() } }, take: 50 });
  for (const r of expired) {
    await deleteFile(r.blobPathname).catch(() => null);
    await db.recording.update({ where: { id: r.id }, data: { blobPathname: "", status: "ERRO", errorMessage: "Áudio removido por fim do prazo de retenção" } });
  }
  await db.accessLog.create({
    data: { kind: "API", path: "/api/cron/limpeza", name: "cron.limpeza", durationMs: null, error: null },
  });
  return NextResponse.json({ logsRemovidos: logs.count, audiosRemovidos: expired.length, retencaoDias: LOG_RETENTION_DAYS });
}
