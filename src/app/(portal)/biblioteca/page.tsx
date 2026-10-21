import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { documentScope, requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { fmtDate } from "@/lib/format";
import { Badge, btnSecondary, ButtonLink, Empty, input, PageHeader } from "@/components/ui";

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; diretoria?: string }> }) {
  const { q, tag, diretoria } = await searchParams;
  const user = await requireUser();
  const and: Prisma.DocumentWhereInput[] = [documentScope(user)];
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }] });
  if (tag) and.push({ tags: { has: tag } });
  if (diretoria) and.push({ directorateId: diretoria === "geral" ? null : diretoria });

  const [docs, directorates] = await Promise.all([
    db.document.findMany({
      where: { AND: and },
      include: { directorate: true, versions: { orderBy: { number: "desc" }, take: 1 }, _count: { select: { versions: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    directoratesFor(user),
  ]);

  return (
    <>
      <PageHeader title="Biblioteca" subtitle="Documentos com versões, etiquetas e vínculos a reuniões e ações." actions={user.role !== "LEITOR" && <ButtonLink href="/biblioteca/novo">Enviar documento</ButtonLink>} />
      <form className="mb-4 flex flex-wrap gap-2 rounded-brand border border-line bg-surface p-3">
        <input name="q" defaultValue={q} placeholder="Buscar por título, descrição ou etiqueta" className={`${input} min-w-48 flex-1`} />
        <select name="diretoria" defaultValue={diretoria ?? ""} className={`${input} w-auto`}>
          <option value="">Todas as diretorias</option>
          <option value="geral">Geral</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className={btnSecondary}>Buscar</button>
      </form>
      {tag && <p className="mb-3 text-sm">Etiqueta: <Badge>{tag}</Badge> <Link href="/biblioteca" className="text-ink-3 underline">limpar</Link></p>}
      {docs.length === 0 ? (
        <Empty>Nenhum documento encontrado.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-brand border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
              <tr><th className="px-4 py-2">Documento</th><th>Diretoria</th><th>Etiquetas</th><th>Versão</th><th>Atualizado</th></tr>
            </thead>
            <tbody className="divide-y divide-grid">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2">
                    <Link href={`/biblioteca/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                    {d.restricted && <Badge className="ml-2 bg-warning/15 text-s6">restrito</Badge>}
                  </td>
                  <td>{d.directorate?.name ?? "Geral"}</td>
                  <td className="space-x-1">{d.tags.map((t) => <Link key={t} href={`/biblioteca?tag=${encodeURIComponent(t)}`}><Badge>{t}</Badge></Link>)}</td>
                  <td>v{d.versions[0]?.number ?? "—"}</td>
                  <td>{fmtDate(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
