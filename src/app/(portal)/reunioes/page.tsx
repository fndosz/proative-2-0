import Link from "next/link";
import { db } from "@/lib/db";
import { directorateScope, requireUser } from "@/lib/authz";
import { fmtDateTime, MEETING_STATUS_LABEL, MINUTES_STATUS_LABEL } from "@/lib/format";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/ui";

export default async function ReunioesPage() {
  const user = await requireUser();
  const meetings = await db.meeting.findMany({
    where: directorateScope(user),
    orderBy: { date: "desc" },
    include: { directorate: true, minutes: true, _count: { select: { actions: true } } },
  });

  return (
    <>
      <PageHeader
        title="Reuniões e atas"
        subtitle="Lista cronológica. Abra a reunião para editar a ata, converter encaminhamentos em ações e exportar PDF."
        actions={user.role !== "LEITOR" && <ButtonLink href="/reunioes/nova">Nova reunião</ButtonLink>}
      />
      {meetings.length === 0 ? (
        <Empty>Nenhuma reunião cadastrada ainda.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-brand border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
              <tr>
                <th className="px-4 py-2">Data</th><th>Reunião</th><th>Diretoria</th><th>Situação</th><th>Ata</th><th>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-2">{fmtDateTime(m.date)}</td>
                  <td><Link href={`/reunioes/${m.id}`} className="font-medium hover:underline">{m.title}</Link><div className="text-xs text-ink-3">{m.type}</div></td>
                  <td>{m.directorate?.name ?? "Geral"}</td>
                  <td>{MEETING_STATUS_LABEL[m.status]}</td>
                  <td>
                    <Badge className={m.minutes?.status === "APROVADA" ? "bg-s4/12 text-s4" : undefined}>
                      {m.minutes ? MINUTES_STATUS_LABEL[m.minutes.status] : "—"}
                    </Badge>
                  </td>
                  <td>{m._count.actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
