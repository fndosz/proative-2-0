import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canEdit, canView, documentScope, requireUser } from "@/lib/authz";
import { addGoal, deleteGoal } from "@/actions/directorates";
import { ACTION_STATUS_COLOR, ACTION_STATUS_LABEL, fmtDate, fmtDateTime, isOverdue } from "@/lib/format";
import { Badge, btnSecondary, ButtonLink, Card, Empty, input, KpiStrip, PageHeader } from "@/components/ui";

export default async function DiretoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const d = await db.directorate.findUnique({
    where: { slug },
    include: {
      goals: { orderBy: { createdAt: "asc" } },
      actions: { where: { status: { not: "CONCLUIDA" } }, include: { owner: true }, orderBy: { dueDate: { sort: "asc", nulls: "last" } } },
      meetings: { orderBy: { date: "desc" }, take: 5 },
      documents: { where: documentScope(user), orderBy: { updatedAt: "desc" }, take: 8 },
      members: { include: { user: true } },
    },
  });
  if (!d || !canView(user, d.id)) notFound();
  const editable = canEdit(user, d.id);
  const all = await db.actionItem.groupBy({ by: ["status"], where: { directorateId: d.id }, _count: true });
  const total = all.reduce((n, a) => n + a._count, 0);
  const done = all.find((a) => a.status === "CONCLUIDA")?._count ?? 0;
  const overdue = d.actions.filter((a) => isOverdue(a.dueDate, a.status)).length;

  return (
    <>
      <PageHeader eyebrow="Diretoria" title={d.name} subtitle={d.description ?? undefined} actions={editable && <><ButtonLink href="/acoes/nova">Nova ação</ButtonLink><ButtonLink href="/reunioes/nova" variant="secondary">Nova reunião</ButtonLink></>} />
      <div className="mb-4">
        <KpiStrip items={[
          { label: "Ações abertas", value: d.actions.length },
          { label: "Atrasadas", value: overdue, tone: overdue ? "critical" : "accent" },
          { label: "Concluídas", value: total ? `${Math.round((done / total) * 100)}%` : "—", tone: "good" },
        ]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Metas">
          {d.goals.length ? (
            <ul className="space-y-2 text-sm">
              {d.goals.map((g) => (
                <li key={g.id} className="flex justify-between gap-2">
                  <div><div className="font-medium">{g.title}</div><div className="text-xs text-ink-3">{g.description}{g.dueDate && ` · até ${fmtDate(g.dueDate)}`}</div></div>
                  {editable && <form action={deleteGoal.bind(null, g.id)}><button className="text-xs text-accent-ink underline">×</button></form>}
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhuma meta cadastrada.</Empty>}
          {editable && (
            <form action={addGoal.bind(null, d.id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <input name="title" placeholder="Nova meta" required className={input} />
              <input name="dueDate" type="date" className={input} />
              <button className={btnSecondary}>Adicionar</button>
            </form>
          )}
        </Card>
        <Card title="Indicadores">
          <p className="text-sm text-ink-3">Os indicadores da diretoria entram na fase 2. Por enquanto, o andamento é medido pelas ações acima.</p>
        </Card>
        <Card title="Ações abertas" actions={<Link href={`/acoes?diretoria=${d.id}`} className="text-sm text-accent">Ver todas</Link>}>
          {d.actions.length ? (
            <ul className="divide-y divide-grid text-sm">
              {d.actions.slice(0, 10).map((a) => (
                <li key={a.id} className="flex justify-between gap-2 py-2">
                  <div><Link href={`/acoes/${a.id}`} className="hover:underline">{a.title}</Link><div className="text-xs text-ink-3">{a.owner?.name ?? "—"} · {fmtDate(a.dueDate)}</div></div>
                  <Badge className={ACTION_STATUS_COLOR[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhuma ação aberta.</Empty>}
        </Card>
        <Card title="Documentos" actions={<Link href={`/biblioteca?diretoria=${d.id}`} className="text-sm text-accent">Ver todos</Link>}>
          {d.documents.length ? (
            <ul className="space-y-1 text-sm">{d.documents.map((doc) => <li key={doc.id}><Link href={`/biblioteca/${doc.id}`} className="hover:underline">{doc.title}</Link></li>)}</ul>
          ) : <Empty>Nenhum documento.</Empty>}
        </Card>
        <Card title="Reuniões recentes">
          {d.meetings.length ? (
            <ul className="space-y-1 text-sm">{d.meetings.map((m) => <li key={m.id}><Link href={`/reunioes/${m.id}`} className="hover:underline">{m.title}</Link> <span className="text-xs text-ink-3">· {fmtDateTime(m.date)}</span></li>)}</ul>
          ) : <Empty>Nenhuma reunião.</Empty>}
        </Card>
        <Card title="Membros">
          {d.members.length ? (
            <ul className="space-y-1 text-sm">{d.members.map((m) => <li key={m.userId}>{m.user.name ?? m.user.email} <span className="text-xs text-ink-3">· {m.access === "EDICAO" ? "edição" : "leitura"}</span></li>)}</ul>
          ) : <Empty>Nenhum membro vinculado.</Empty>}
        </Card>
      </div>
    </>
  );
}
