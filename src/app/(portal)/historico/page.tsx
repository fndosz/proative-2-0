import Link from "next/link";
import { db } from "@/lib/db";
import { directorateScope, isAdmin, requireUser } from "@/lib/authz";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";

const LINK: Record<string, string> = { Meeting: "/reunioes/", ActionItem: "/acoes/", Document: "/biblioteca/" };

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUser();
  const page = Math.max(1, Number((await searchParams).pagina ?? 1));
  const take = 50;

  // Não-admin vê só eventos de reuniões, ações e documentos das suas diretorias
  let where = {};
  if (!isAdmin(user)) {
    const scope = directorateScope(user);
    const [m, a, d] = await Promise.all([
      db.meeting.findMany({ where: scope, select: { id: true } }),
      db.actionItem.findMany({ where: scope, select: { id: true } }),
      db.document.findMany({ where: { ...scope, restricted: false }, select: { id: true } }),
    ]);
    where = {
      OR: [
        { entityType: "Meeting", entityId: { in: m.map((x) => x.id) } },
        { entityType: "ActionItem", entityId: { in: a.map((x) => x.id) } },
        { entityType: "Document", entityId: { in: d.map((x) => x.id) } },
      ],
    };
  }
  const events = await db.auditEvent.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, take: take + 1, skip: (page - 1) * take });

  return (
    <>
      <PageHeader title="Histórico" subtitle="Linha do tempo: quem fez o quê e quando." />
      {events.length === 0 ? <Empty>Nada registrado ainda.</Empty> : (
        <ol className="relative space-y-3 border-l border-slate-200 pl-5">
          {events.slice(0, take).map((e) => (
            <li key={e.id} className="text-sm">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--brand)]" />
              <div className="text-xs text-slate-500">{fmtDateTime(e.createdAt)} · {e.actor?.name ?? e.actor?.email ?? "Sistema"}</div>
              {LINK[e.entityType] ? <Link href={LINK[e.entityType] + e.entityId} className="hover:underline">{e.summary}</Link> : e.summary}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 flex gap-3 text-sm">
        {page > 1 && <Link href={`/historico?pagina=${page - 1}`} className="underline">← Mais recentes</Link>}
        {events.length > take && <Link href={`/historico?pagina=${page + 1}`} className="underline">Mais antigos →</Link>}
      </div>
    </>
  );
}
