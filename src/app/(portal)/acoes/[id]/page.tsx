import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canEdit, canView, directorateScope, documentScope, requireUser } from "@/lib/authz";
import { activeUsers, directoratesFor } from "@/lib/directorates";
import { addComment, attachToAction, updateAction } from "@/actions/action-items";
import { ACTION_STATUS_COLOR, ACTION_STATUS_LABEL, fmtDate, fmtDateTime, PRIORITY_LABEL } from "@/lib/format";
import { ActionFields } from "@/components/action-form";
import { Badge, btnPrimary, btnSecondary, Card, Empty, input, PageHeader } from "@/components/ui";

export default async function AcaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const action = await db.actionItem.findFirst({
    where: { id, ...directorateScope(user) },
    include: {
      owner: true, createdBy: true, directorate: true, meeting: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      documents: { where: { document: documentScope(user) }, include: { document: { include: { versions: { orderBy: { number: "desc" }, take: 1 } } } } },
    },
  });
  if (!action || !canView(user, action.directorateId)) notFound();
  const editable = canEdit(user, action.directorateId);
  const [directorates, users, history] = await Promise.all([
    editable ? directoratesFor(user, "edit") : [],
    editable ? activeUsers() : [],
    db.auditEvent.findMany({ where: { entityType: "ActionItem", entityId: id }, include: { actor: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={action.title}
        subtitle={`${action.directorate?.name ?? "Geral"} · criada por ${action.createdBy.name ?? action.createdBy.email} em ${fmtDate(action.createdAt)}`}
        actions={<Badge className={ACTION_STATUS_COLOR[action.status]}>{ACTION_STATUS_LABEL[action.status]}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Detalhes">
            {editable ? (
              <form action={updateAction.bind(null, action.id)} className="space-y-4">
                <ActionFields directorates={directorates} users={users} action={action} />
                <button className={btnPrimary}>Salvar</button>
              </form>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-ink-3">Responsável</dt><dd>{action.owner?.name ?? "—"}</dd>
                <dt className="text-ink-3">Prazo</dt><dd>{fmtDate(action.dueDate)}</dd>
                <dt className="text-ink-3">Prioridade</dt><dd>{PRIORITY_LABEL[action.priority]}</dd>
                <dt className="col-span-2 text-ink-3">Descrição</dt>
                <dd className="col-span-2 whitespace-pre-wrap">{action.description || "—"}</dd>
              </dl>
            )}
          </Card>

          <Card title="Comentários">
            {action.comments.length ? (
              <ul className="mb-3 space-y-3">
                {action.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                    <div className="mb-1 text-xs text-ink-3">{c.author.name ?? c.author.email} · {fmtDateTime(c.createdAt)}</div>
                    <div className="whitespace-pre-wrap">{c.body}</div>
                  </li>
                ))}
              </ul>
            ) : <Empty>Sem comentários.</Empty>}
            {user.role !== "LEITOR" && (
              <form action={addComment.bind(null, action.id)} className="mt-3 space-y-2">
                <textarea name="body" rows={3} required className={input} placeholder="Escreva um comentário" />
                <button className={btnSecondary}>Comentar</button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Origem">
            {action.meeting ? (
              <Link href={`/reunioes/${action.meeting.id}`} className="text-sm hover:underline">Reunião: {action.meeting.title} ({fmtDate(action.meeting.date)})</Link>
            ) : <p className="text-sm text-ink-3">Criada diretamente no plano de ação.</p>}
          </Card>

          <Card title="Anexos">
            {action.documents.length ? (
              <ul className="space-y-1 text-sm">
                {action.documents.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <Link href={`/biblioteca/${l.documentId}`} className="truncate hover:underline">{l.document.title}</Link>
                    {l.document.versions[0] && <a href={`/api/arquivos/${l.document.versions[0].id}`} className="text-xs text-accent">baixar</a>}
                  </li>
                ))}
              </ul>
            ) : <Empty>Nenhum anexo.</Empty>}
            {editable && (
              <form action={attachToAction.bind(null, action.id)} className="mt-3 space-y-2">
                <input type="file" name="file" required className="text-sm" />
                <button className={`${btnSecondary} w-full`}>Anexar</button>
              </form>
            )}
          </Card>

          <Card title="Histórico">
            <ul className="space-y-2 text-xs">
              {history.map((h) => (
                <li key={h.id}><span className="text-ink-3">{fmtDateTime(h.createdAt)} · {h.actor?.name ?? "Sistema"}</span><br />{h.summary}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
