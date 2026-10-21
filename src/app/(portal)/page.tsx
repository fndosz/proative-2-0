import Link from "next/link";
import { db } from "@/lib/db";
import { directorateScope, requireUser, visibleDirectorateIds } from "@/lib/authz";
import { ACTION_STATUS_LABEL, fmtDate, fmtDateTime, startOfToday } from "@/lib/format";
import { Badge, ButtonLink, Card, Empty, PageHeader } from "@/components/ui";

export default async function PainelPage() {
  const user = await requireUser();
  const scope = directorateScope(user);
  const today = startOfToday();
  const dirIds = visibleDirectorateIds(user);

  const [byStatus, overdue, upcoming, pendingDecisions, directorates] = await Promise.all([
    db.actionItem.groupBy({ by: ["status"], where: scope, _count: true }),
    db.actionItem.findMany({
      where: { ...scope, status: { not: "CONCLUIDA" }, dueDate: { lt: today } },
      include: { owner: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.meeting.findMany({
      where: { ...scope, status: "AGENDADA", date: { gte: today } },
      orderBy: { date: "asc" },
      take: 5,
      include: { directorate: true },
    }),
    db.decision.findMany({
      where: { status: "PENDENTE", minutes: { meeting: scope } },
      include: { minutes: { include: { meeting: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.directorate.findMany({
      where: dirIds === null ? {} : { id: { in: dirIds } },
      orderBy: { sortOrder: "asc" },
      include: { actions: { select: { status: true, dueDate: true } } },
    }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const total = byStatus.reduce((n, b) => n + b._count, 0);
  const done = count("CONCLUIDA");

  return (
    <>
      <PageHeader title="Painel geral" subtitle={`Olá, ${user.name?.split(" ")[0] ?? ""}. Visão consolidada do andamento.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Ações", total],
          ["Em andamento", count("EM_ANDAMENTO")],
          ["Bloqueadas", count("BLOQUEADA")],
          ["Atrasadas", overdue.length],
          ["Concluídas", total ? `${Math.round((done / total) * 100)}%` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{l}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Próximas reuniões" actions={<Link href="/reunioes" className="text-sm text-[var(--brand)]">Ver todas</Link>}>
          {upcoming.length === 0 ? (
            <Empty>Nenhuma reunião agendada. <Link className="underline" href="/reunioes/nova">Agendar reunião</Link></Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((m) => (
                <li key={m.id} className="py-2">
                  <Link href={`/reunioes/${m.id}`} className="font-medium hover:underline">{m.title}</Link>
                  <div className="text-xs text-slate-500">{fmtDateTime(m.date)} · {m.directorate?.name ?? "Geral"}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ações atrasadas" actions={<Link href="/acoes?atrasadas=1" className="text-sm text-[var(--brand)]">Ver no plano</Link>}>
          {overdue.length === 0 ? (
            <Empty>Nenhuma ação atrasada.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdue.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                  <div>
                    <Link href={`/acoes/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                    <div className="text-xs text-slate-500">{a.owner?.name ?? "Sem responsável"} · {ACTION_STATUS_LABEL[a.status]}</div>
                  </div>
                  <Badge className="bg-red-100 text-red-800">{fmtDate(a.dueDate)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Decisões pendentes">
          {pendingDecisions.length === 0 ? (
            <Empty>Nenhuma decisão pendente.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingDecisions.map((d) => (
                <li key={d.id} className="py-2">
                  <div className="text-sm">{d.text}</div>
                  <Link href={`/reunioes/${d.minutes.meetingId}`} className="text-xs text-slate-500 hover:underline">{d.minutes.meeting.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Resumo por diretoria">
          {directorates.length === 0 ? (
            <Empty>Você ainda não está vinculado a nenhuma diretoria.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-1">Diretoria</th><th>Abertas</th><th>Atrasadas</th><th>Concluídas</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directorates.map((d) => {
                  const open = d.actions.filter((a) => a.status !== "CONCLUIDA");
                  return (
                    <tr key={d.id}>
                      <td className="py-2"><Link href={`/diretorias/${d.slug}`} className="hover:underline">{d.name}</Link></td>
                      <td>{open.length}</td>
                      <td>{open.filter((a) => a.dueDate && a.dueDate < today).length}</td>
                      <td>{d.actions.length - open.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {total === 0 && upcoming.length === 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/reunioes/nova">Agendar primeira reunião</ButtonLink>
          <ButtonLink href="/acoes/nova" variant="secondary">Criar primeira ação</ButtonLink>
        </div>
      )}
    </>
  );
}
