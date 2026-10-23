import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { directorateScope, requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { fmtDateTime } from "@/lib/format";
import { Badge, btnSecondary, ButtonLink, Empty, input, PageHeader } from "@/components/ui";

export default async function AnotacoesPage({ searchParams }: { searchParams: Promise<{ q?: string; diretoria?: string; arquivadas?: string }> }) {
  const { q, diretoria, arquivadas } = await searchParams;
  const user = await requireUser();
  const showArchived = arquivadas === "1";
  const and: Prisma.NoteWhereInput[] = [directorateScope(user), { archivedAt: showArchived ? { not: null } : null }];
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }, { participants: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }] });
  if (diretoria) and.push({ directorateId: diretoria === "geral" ? null : diretoria });

  const [notes, directorates] = await Promise.all([
    db.note.findMany({ where: { AND: and }, include: { directorate: true, createdBy: true }, orderBy: { date: "desc" }, take: 200 }),
    directoratesFor(user),
  ]);

  return (
    <>
      <PageHeader
        title={showArchived ? "Anotações arquivadas" : "Anotações"}
        subtitle="Registros rápidos de reuniões e conversas sem ata formal: o que foi abordado, com quem, quando. Depois, se precisar, vira reunião com ata."
        actions={
          <>
            <Link href={showArchived ? "/anotacoes" : "/anotacoes?arquivadas=1"} className={btnSecondary}>{showArchived ? "Ver ativas" : "Ver arquivadas"}</Link>
            {user.role !== "LEITOR" && !showArchived && <ButtonLink href="/anotacoes/nova">Nova anotação</ButtonLink>}
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2 rounded-brand border border-line bg-surface p-3">
        {showArchived && <input type="hidden" name="arquivadas" value="1" />}
        <input name="q" defaultValue={q} placeholder="Buscar por título, texto, pessoa ou etiqueta" className={`${input} min-w-48 flex-1`} />
        <select name="diretoria" defaultValue={diretoria ?? ""} className={`${input} w-auto`}>
          <option value="">Todas as diretorias</option>
          <option value="geral">Geral</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className={btnSecondary}>Buscar</button>
      </form>
      {notes.length === 0 ? (
        <Empty>{showArchived ? "Nenhuma anotação arquivada." : "Nenhuma anotação ainda. Registre aqui os pontos de uma reunião que não teve ata."}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-brand border border-line bg-surface p-4 hover:border-accent">
              <Link href={`/anotacoes/${n.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[15px] font-semibold text-ink">{n.title}</h3>
                  {n.meetingId && <Badge className="bg-s2/12 text-s2">virou reunião</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">{fmtDateTime(n.date)} · {n.directorate?.name ?? "Geral"}{n.participants ? ` · ${n.participants}` : ""}</div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-[13px] text-ink-2">{n.body}</p>
                {n.tags.length > 0 && <div className="mt-2 space-x-1">{n.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
