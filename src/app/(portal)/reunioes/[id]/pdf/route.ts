import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canView, getCurrentUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { renderMinutesPdf, type MinutesSnapshot } from "@/lib/minutes-pdf";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });
  const { id } = await params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    include: { participants: true, minutes: { include: { decisions: true, referrals: true, versions: true } } },
  });
  if (!meeting || !meeting.minutes || !canView(user, meeting.directorateId)) return new NextResponse("Não encontrado", { status: 404 });

  const versao = Number(new URL(req.url).searchParams.get("versao") ?? 0);
  let snapshot: MinutesSnapshot;
  let label: string;
  let draft = false;
  if (versao) {
    const v = meeting.minutes.versions.find((x) => x.number === versao);
    if (!v) return new NextResponse("Versão não encontrada", { status: 404 });
    snapshot = v.snapshot as unknown as MinutesSnapshot;
    label = `Versão ${v.number} aprovada em ${v.approvedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
  } else {
    const m = meeting.minutes;
    snapshot = {
      meeting: { title: meeting.title, type: meeting.type, date: meeting.date.toISOString(), location: meeting.location },
      participants: meeting.participants.map((p) => ({ name: p.name, role: p.role, present: p.present })),
      agenda: m.agenda, discussions: m.discussions, generalTopics: m.generalTopics, closing: m.closing,
      decisions: m.decisions.map((d) => ({ text: d.text, status: d.status })),
      referrals: m.referrals.map((r) => ({ text: r.text, ownerName: r.ownerName, dueDate: r.dueDate?.toISOString() ?? null })),
    };
    draft = m.status !== "APROVADA";
    label = draft ? "Rascunho gerado pelo portal Proative 2.0" : "Ata aprovada — Proative 2.0";
  }

  const pdf = await renderMinutesPdf(snapshot, { label, draft });
  await audit({ actorId: user.id, action: "minutes.pdf", entityType: "Meeting", entityId: id, summary: `Exportou PDF da ata${versao ? ` (versão ${versao})` : ""}` });
  const filename = `ata-${meeting.date.toISOString().slice(0, 10)}${versao ? `-v${versao}` : ""}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
