import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canEdit, directorateScope, requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { archiveNote, convertNoteToMeeting, deleteNote, updateNote } from "@/actions/notes";
import { fmtDateTime } from "@/lib/format";
import { NoteFields } from "@/components/note-form";
import { ConfirmButton, SubmitButton } from "@/components/submit-button";
import { Badge, btnDanger, btnPrimary, btnSecondary, Card, PageHeader } from "@/components/ui";

export default async function AnotacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const note = await db.note.findFirst({ where: { id, ...directorateScope(user) }, include: { directorate: true, createdBy: true } });
  if (!note) notFound();
  const editable = canEdit(user, note.directorateId);
  const directorates = editable ? await directoratesFor(user, "edit") : [];
  const history = await db.auditEvent.findMany({ where: { entityType: "Note", entityId: id }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <>
      <PageHeader
        eyebrow="Anotação"
        title={note.title}
        subtitle={`${fmtDateTime(note.date)} · ${note.directorate?.name ?? "Geral"} · registrada por ${note.createdBy.name ?? note.createdBy.email}`}
        actions={
          <>
            {note.meetingId ? (
              <Link href={`/reunioes/${note.meetingId}`} className={btnSecondary}>Abrir a reunião gerada</Link>
            ) : (
              editable && (
                <form action={convertNoteToMeeting.bind(null, note.id)}>
                  <SubmitButton className={btnPrimary} pendingText="Convertendo…">Transformar em reunião com ata</SubmitButton>
                </form>
              )
            )}
          </>
        }
      />
      {note.archivedAt && <p className="mb-4 rounded-lg bg-surface-2 p-3 text-sm text-ink-2">Anotação arquivada em {fmtDateTime(note.archivedAt)}.</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editable ? (
            <Card title="Editar">
              <form action={updateNote.bind(null, note.id)} className="space-y-4">
                <NoteFields directorates={directorates} note={note} />
                <SubmitButton className={btnPrimary}>Salvar</SubmitButton>
              </form>
            </Card>
          ) : (
            <Card title="Pontos abordados">
              {note.participants && <p className="mb-2 text-[13px] text-ink-2"><b>Participantes:</b> {note.participants}</p>}
              <p className="whitespace-pre-wrap text-[13px] text-ink">{note.body}</p>
              {note.tags.length > 0 && <div className="mt-3 space-x-1">{note.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Sobre">
            <p className="text-[13px] text-ink-2">
              Anotações servem para encontros sem ata formal. Ao <b>transformar em reunião</b>, este texto vira o rascunho da ata, os participantes entram na lista e você pode usar <b>Gerar ata com IA</b> para formatar no modelo Proative.
            </p>
          </Card>
          <Card title="Histórico">
            <ul className="space-y-2 text-xs">
              {history.map((h) => (
                <li key={h.id}><span className="text-ink-3">{fmtDateTime(h.createdAt)} · {h.actor?.name ?? "Sistema"}</span><br />{h.summary}</li>
              ))}
            </ul>
          </Card>
          {editable && (
            <Card title="Ações">
              <div className="flex flex-wrap gap-2">
                <form action={archiveNote.bind(null, note.id)}><SubmitButton className={btnSecondary} pendingText="Aguarde…">{note.archivedAt ? "Desarquivar" : "Arquivar"}</SubmitButton></form>
                <form action={deleteNote.bind(null, note.id)}><ConfirmButton className={btnDanger} message={`Remover a anotação "${note.title}"? Esta ação não pode ser desfeita.`}>Remover</ConfirmButton></form>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
