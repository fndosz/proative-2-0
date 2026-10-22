import Link from "next/link";
import { db } from "@/lib/db";
import { canEdit, directorateScope, requireUser } from "@/lib/authz";
import { archiveMeeting, deleteMeeting } from "@/actions/meetings";
import { fmtDateTime, MEETING_STATUS_LABEL, MINUTES_STATUS_LABEL } from "@/lib/format";
import { ConfirmButton } from "@/components/submit-button";
import { Badge, btnSecondary, ButtonLink, Empty, PageHeader } from "@/components/ui";

export default async function ReunioesPage({ searchParams }: { searchParams: Promise<{ arquivadas?: string }> }) {
  const { arquivadas } = await searchParams;
  const showArchived = arquivadas === "1";
  const user = await requireUser();
  const meetings = await db.meeting.findMany({
    where: { ...directorateScope(user), archivedAt: showArchived ? { not: null } : null },
    orderBy: { date: "desc" },
    include: { directorate: true, minutes: { include: { _count: { select: { versions: true } } } }, _count: { select: { actions: true } } },
  });

  return (
    <>
      <PageHeader
        title={showArchived ? "Reuniões arquivadas" : "Reuniões e atas"}
        subtitle="Lista cronológica. Abra a reunião para editar a ata, converter encaminhamentos em ações e exportar PDF."
        actions={
          <>
            <Link href={showArchived ? "/reunioes" : "/reunioes?arquivadas=1"} className={btnSecondary}>
              {showArchived ? "Ver ativas" : "Ver arquivadas"}
            </Link>
            {user.role !== "LEITOR" && !showArchived && <ButtonLink href="/reunioes/nova">Nova reunião</ButtonLink>}
          </>
        }
      />
      {meetings.length === 0 ? (
        <Empty>{showArchived ? "Nenhuma reunião arquivada." : "Nenhuma reunião cadastrada ainda."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-brand border border-line bg-surface">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
              <tr>
                <th className="px-4 py-2">Data</th><th>Reunião</th><th>Diretoria</th><th>Situação</th><th>Ata</th><th>Versão</th><th>Plano</th><th className="pr-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {meetings.map((m) => {
                const editable = canEdit(user, m.directorateId);
                const versions = m.minutes?._count.versions ?? 0;
                return (
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
                    <td className="num text-ink-2" title="Versões aprovadas da ata">{versions ? `v${versions}` : "—"}</td>
                    <td className="num" title="Ações no plano de ação">{m._count.actions}</td>
                    <td className="pr-4">
                      {editable && (
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap text-xs">
                          <Link href={`/reunioes/${m.id}#editar`} className="text-ink-2 hover:text-accent-ink hover:underline">Atualizar</Link>
                          <form action={archiveMeeting.bind(null, m.id)}>
                            <button className="text-ink-2 hover:text-accent-ink hover:underline">{m.archivedAt ? "Desarquivar" : "Arquivar"}</button>
                          </form>
                          {m._count.actions === 0 && (
                            <form action={deleteMeeting.bind(null, m.id)}>
                              <ConfirmButton className="text-accent-ink hover:underline" message={`Remover a reunião "${m.title}" e sua ata? Esta ação não pode ser desfeita.`}>
                                Remover
                              </ConfirmButton>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
