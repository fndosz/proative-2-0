import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canEdit, directorateScope, requireUser } from "@/lib/authz";
import { activeUsers, directoratesFor } from "@/lib/directorates";
import { ACTION_STATUS_COLOR, ACTION_STATUS_LABEL, fmtDate, isOverdue, PRIORITY_LABEL, startOfToday } from "@/lib/format";
import { Kanban } from "@/components/kanban";
import { Badge, btnSecondary, ButtonLink, Empty, input, PageHeader } from "@/components/ui";

type SP = { view?: string; diretoria?: string; responsavel?: string; prioridade?: string; status?: string; prazo?: string; atrasadas?: string };

export default async function AcoesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const view = sp.view === "kanban" ? "kanban" : "lista";

  const where: Prisma.ActionItemWhereInput = { AND: [directorateScope(user)] };
  const and = where.AND as Prisma.ActionItemWhereInput[];
  if (sp.diretoria) and.push({ directorateId: sp.diretoria === "geral" ? null : sp.diretoria });
  if (sp.responsavel) and.push({ ownerId: sp.responsavel === "eu" ? user.id : sp.responsavel });
  if (sp.prioridade) and.push({ priority: sp.prioridade as Prisma.EnumPriorityFilter["equals"] });
  if (sp.status) and.push({ status: sp.status as Prisma.EnumActionStatusFilter["equals"] });
  if (sp.prazo) and.push({ dueDate: { lte: new Date(`${sp.prazo}T23:59:59-03:00`) } });
  if (sp.atrasadas) and.push({ status: { not: "CONCLUIDA" }, dueDate: { lt: startOfToday() } });

  const [actions, directorates, users] = await Promise.all([
    db.actionItem.findMany({
      where,
      include: { owner: true, directorate: true, meeting: true },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    directoratesFor(user),
    activeUsers(),
  ]);

  const qs = (extra: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/acoes?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Plano de ação"
        actions={
          <>
            <Link href={qs({ view: "lista" })} className={view === "lista" ? "rounded-lg bg-ink px-3 py-2 text-sm text-white" : btnSecondary}>Lista</Link>
            <Link href={qs({ view: "kanban" })} className={view === "kanban" ? "rounded-lg bg-ink px-3 py-2 text-sm text-white" : btnSecondary}>Kanban</Link>
            {user.role !== "LEITOR" && <ButtonLink href="/acoes/nova">Nova ação</ButtonLink>}
          </>
        }
      />

      <form className="mb-4 grid gap-2 rounded-brand border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input type="hidden" name="view" value={view} />
        <select name="diretoria" defaultValue={sp.diretoria ?? ""} className={input}>
          <option value="">Todas as diretorias</option>
          <option value="geral">Geral</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select name="responsavel" defaultValue={sp.responsavel ?? ""} className={input}>
          <option value="">Todos os responsáveis</option>
          <option value="eu">Minhas ações</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
        </select>
        <select name="prioridade" defaultValue={sp.prioridade ?? ""} className={input}>
          <option value="">Qualquer prioridade</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {view === "lista" ? (
          <select name="status" defaultValue={sp.status ?? ""} className={input}>
            <option value="">Qualquer situação</option>
            {Object.entries(ACTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : <span />}
        <input type="date" name="prazo" defaultValue={sp.prazo ?? ""} className={input} title="Prazo até" />
        <div className="flex gap-2">
          <button className={btnSecondary}>Filtrar</button>
          <Link href={`/acoes?view=${view}`} className="self-center text-sm text-ink-3 underline">Limpar</Link>
        </div>
      </form>

      {actions.length === 0 ? (
        <Empty>Nenhuma ação encontrada.</Empty>
      ) : view === "kanban" ? (
        <Kanban
          cards={actions.map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            owner: a.owner?.name ?? null,
            due: a.dueDate ? fmtDate(a.dueDate) : null,
            overdue: isOverdue(a.dueDate, a.status),
            priority: PRIORITY_LABEL[a.priority],
            editable: canEdit(user, a.directorateId),
          }))}
        />
      ) : (
        <div className="overflow-x-auto rounded-brand border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
              <tr><th className="px-4 py-2">Ação</th><th>Responsável</th><th>Diretoria</th><th>Prazo</th><th>Prioridade</th><th>Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {actions.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2">
                    <Link href={`/acoes/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                    {a.meeting && <div className="text-xs text-ink-3">Origem: {a.meeting.title}</div>}
                  </td>
                  <td>{a.owner?.name ?? "—"}</td>
                  <td>{a.directorate?.name ?? "Geral"}</td>
                  <td className={isOverdue(a.dueDate, a.status) ? "font-medium text-accent-ink" : ""}>{fmtDate(a.dueDate)}</td>
                  <td>{PRIORITY_LABEL[a.priority]}</td>
                  <td><Badge className={ACTION_STATUS_COLOR[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
