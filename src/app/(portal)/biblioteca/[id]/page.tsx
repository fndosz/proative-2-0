import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canEdit, directorateScope, documentScope, isAdmin, requireUser } from "@/lib/authz";
import { activeUsers } from "@/lib/directorates";
import { addVersion, linkDocument, setDocumentAccess, unlinkDocument, updateDocument } from "@/actions/documents";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, btnPrimary, btnSecondary, Card, Empty, Field, input, PageHeader } from "@/components/ui";

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findFirst({
    where: { id, ...documentScope(user) },
    include: {
      directorate: true, createdBy: true,
      versions: { orderBy: { number: "desc" }, include: { uploadedBy: true } },
      links: { include: { meeting: true, action: true } },
      access: true,
    },
  });
  if (!doc) notFound();
  const editable = canEdit(user, doc.directorateId);
  const manageAccess = editable && (isAdmin(user) || doc.createdById === user.id);
  const [users, meetings, actions] = editable
    ? await Promise.all([
        activeUsers(),
        db.meeting.findMany({ where: directorateScope(user), orderBy: { date: "desc" }, take: 50 }),
        db.actionItem.findMany({ where: directorateScope(user), orderBy: { createdAt: "desc" }, take: 50 }),
      ])
    : [[], [], []];

  return (
    <>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.directorate?.name ?? "Geral"} · enviado por ${doc.createdBy.name ?? doc.createdBy.email} em ${fmtDate(doc.createdAt)}`}
        actions={doc.versions[0] && <a href={`/api/arquivos/${doc.versions[0].id}`} className={btnPrimary}>Baixar versão atual</a>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Versões">
            <ul className="divide-y divide-slate-100 text-sm">
              {doc.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium">v{v.number}</span> · {v.fileName}
                    <div className="text-xs text-slate-500">{size(v.size)} · {v.uploadedBy.name ?? v.uploadedBy.email} · {fmtDateTime(v.createdAt)}</div>
                  </div>
                  <a href={`/api/arquivos/${v.id}`} className="text-sm text-[var(--brand)]">baixar</a>
                </li>
              ))}
            </ul>
            {editable && (
              <form action={addVersion.bind(null, doc.id)} className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <input type="file" name="file" required className="text-sm" />
                <button className={btnSecondary}>Enviar nova versão</button>
              </form>
            )}
          </Card>

          <Card title="Informações">
            {editable ? (
              <form action={updateDocument.bind(null, doc.id)} className="space-y-3">
                <Field label="Título"><input name="title" defaultValue={doc.title} className={input} /></Field>
                <Field label="Descrição"><textarea name="description" rows={3} defaultValue={doc.description ?? ""} className={input} /></Field>
                <Field label="Etiquetas" hint="Separadas por vírgula."><input name="tags" defaultValue={doc.tags.join(", ")} className={input} /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="restricted" defaultChecked={doc.restricted} /> Restrito</label>
                <button className={btnPrimary}>Salvar</button>
              </form>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm">{doc.description || "Sem descrição."}</p>
                <div className="mt-2 space-x-1">{doc.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Vínculos">
            {doc.links.length ? (
              <ul className="space-y-1 text-sm">
                {doc.links.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    {l.meeting ? <Link href={`/reunioes/${l.meeting.id}`} className="hover:underline">Reunião: {l.meeting.title}</Link>
                      : l.action ? <Link href={`/acoes/${l.action.id}`} className="hover:underline">Ação: {l.action.title}</Link> : null}
                    {editable && <form action={unlinkDocument.bind(null, doc.id, l.id)}><button className="text-xs text-red-600 underline">×</button></form>}
                  </li>
                ))}
              </ul>
            ) : <Empty>Sem vínculos.</Empty>}
            {editable && (
              <form action={linkDocument.bind(null, doc.id)} className="mt-3 space-y-2">
                <select name="meetingId" className={input} defaultValue=""><option value="">Vincular a reunião…</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
                <select name="actionId" className={input} defaultValue=""><option value="">ou a ação…</option>{actions.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
                <button className={`${btnSecondary} w-full`}>Vincular</button>
              </form>
            )}
          </Card>

          {manageAccess && doc.restricted && (
            <Card title="Quem pode ver">
              <form action={setDocumentAccess.bind(null, doc.id)} className="space-y-1 text-sm">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2">
                    <input type="checkbox" name="userIds" value={u.id} defaultChecked={doc.access.some((a) => a.userId === u.id)} />
                    {u.name ?? u.email}
                  </label>
                ))}
                <p className="pt-1 text-xs text-slate-500">Administradores e quem enviou sempre têm acesso.</p>
                <button className={`${btnSecondary} mt-2 w-full`}>Salvar acesso</button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
