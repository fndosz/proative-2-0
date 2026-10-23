import Link from "next/link";
import type { AccessKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { fmtDateTime } from "@/lib/format";
import { Badge, btnSecondary, Empty, input, PageHeader } from "@/components/ui";

const KIND_LABEL: Record<AccessKind, string> = { PAGE: "Página", ACTION: "Ação", API: "API", AUTH: "Login", ERROR: "Erro" };
const KIND_COLOR: Record<AccessKind, string> = {
  PAGE: "bg-surface-2 text-ink-2", ACTION: "bg-s2/12 text-s2", API: "bg-surface-2 text-ink-2", AUTH: "bg-s4/12 text-s4", ERROR: "bg-critical/12 text-critical",
};
const PAGE = 100;

type SP = { tipo?: string; usuario?: string; caminho?: string; aba?: string; pagina?: string };

export default async function LogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const aba = sp.aba === "auditoria" ? "auditoria" : "acessos";
  const page = Math.max(1, Number(sp.pagina ?? 1));
  const users = await db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });
  const userName = (id: string | null) => {
    const u = users.find((x) => x.id === id);
    return u ? (u.name ?? u.email) : "—";
  };

  const qs = (extra: Partial<SP>) => `/admin/logs?${new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Logs"
        subtitle="Acessos (páginas, ações, erros, logins) e auditoria (quem fez o quê). Logs de acesso são apagados após 90 dias; a auditoria é permanente."
        actions={
          <>
            <Link href={qs({ aba: "acessos", pagina: "" })} className={aba === "acessos" ? "rounded-lg bg-ink px-3 py-2 text-sm text-white" : btnSecondary}>Acessos</Link>
            <Link href={qs({ aba: "auditoria", pagina: "" })} className={aba === "auditoria" ? "rounded-lg bg-ink px-3 py-2 text-sm text-white" : btnSecondary}>Auditoria</Link>
            <Link href="/admin" className={btnSecondary}>Indicadores</Link>
          </>
        }
      />

      <form className="mb-4 grid gap-2 rounded-brand border border-line bg-surface p-3 sm:grid-cols-4">
        <input type="hidden" name="aba" value={aba} />
        <select name="usuario" defaultValue={sp.usuario ?? ""} className={input}>
          <option value="">Todos os usuários</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
        </select>
        {aba === "acessos" ? (
          <select name="tipo" defaultValue={sp.tipo ?? ""} className={input}>
            <option value="">Todos os tipos</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : <span />}
        <input name="caminho" defaultValue={sp.caminho ?? ""} placeholder={aba === "acessos" ? "Caminho contém… (ex.: /reunioes)" : "Texto contém…"} className={input} />
        <div className="flex gap-2">
          <button className={btnSecondary}>Filtrar</button>
          <Link href={`/admin/logs?aba=${aba}`} className="self-center text-sm text-ink-3 underline">Limpar</Link>
        </div>
      </form>

      {aba === "acessos" ? <AccessTable sp={sp} page={page} userName={userName} qs={qs} /> : <AuditTable sp={sp} page={page} userName={userName} qs={qs} />}
    </>
  );
}

async function AccessTable({ sp, page, userName, qs }: { sp: SP; page: number; userName: (id: string | null) => string; qs: (e: Partial<SP>) => string }) {
  const where: Prisma.AccessLogWhereInput = {};
  if (sp.usuario) where.userId = sp.usuario;
  if (sp.tipo) where.kind = sp.tipo as AccessKind;
  if (sp.caminho) where.OR = [{ path: { contains: sp.caminho } }, { name: { contains: sp.caminho } }, { error: { contains: sp.caminho, mode: "insensitive" } }];
  const rows = await db.accessLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE + 1, skip: (page - 1) * PAGE });
  if (rows.length === 0) return <Empty>Nenhum registro.</Empty>;
  return (
    <>
      <div className="overflow-x-auto rounded-brand border border-line bg-surface">
        <table className="w-full min-w-[800px] text-[13px]">
          <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
            <tr><th className="px-3 py-2">Quando</th><th>Usuário</th><th>Tipo</th><th>Caminho / função</th><th className="text-right">Duração</th><th>Erro</th><th>IP</th></tr>
          </thead>
          <tbody className="divide-y divide-grid">
            {rows.slice(0, PAGE).map((r) => (
              <tr key={r.id} className={r.kind === "ERROR" ? "bg-critical/5" : ""}>
                <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">{fmtDateTime(r.createdAt)}</td>
                <td className="whitespace-nowrap">{userName(r.userId)}</td>
                <td><Badge className={KIND_COLOR[r.kind]}>{KIND_LABEL[r.kind]}</Badge></td>
                <td className="font-mono text-xs">{r.path}{r.name && <span className="text-ink-3"> · {r.name}</span>}</td>
                <td className={`num text-right ${(r.durationMs ?? 0) > 2000 ? "font-semibold text-critical" : ""}`}>{r.durationMs != null ? `${r.durationMs} ms` : "—"}</td>
                <td className="max-w-[280px] truncate text-critical" title={r.error ?? ""}>{r.error}</td>
                <td className="font-mono text-xs text-ink-3">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasMore={rows.length > PAGE} qs={qs} />
    </>
  );
}

async function AuditTable({ sp, page, userName, qs }: { sp: SP; page: number; userName: (id: string | null) => string; qs: (e: Partial<SP>) => string }) {
  const where: Prisma.AuditEventWhereInput = {};
  if (sp.usuario) where.actorId = sp.usuario;
  if (sp.caminho) where.OR = [{ summary: { contains: sp.caminho, mode: "insensitive" } }, { action: { contains: sp.caminho } }];
  const rows = await db.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE + 1, skip: (page - 1) * PAGE });
  if (rows.length === 0) return <Empty>Nenhum registro.</Empty>;
  return (
    <>
      <div className="overflow-x-auto rounded-brand border border-line bg-surface">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="bg-surface-2 text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
            <tr><th className="px-3 py-2">Quando</th><th>Usuário</th><th>Ação</th><th>Resumo</th></tr>
          </thead>
          <tbody className="divide-y divide-grid">
            {rows.slice(0, PAGE).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">{fmtDateTime(r.createdAt)}</td>
                <td className="whitespace-nowrap">{userName(r.actorId)}</td>
                <td className="font-mono text-xs text-ink-3">{r.action}</td>
                <td>{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasMore={rows.length > PAGE} qs={qs} />
    </>
  );
}

function Pager({ page, hasMore, qs }: { page: number; hasMore: boolean; qs: (e: Partial<SP>) => string }) {
  return (
    <div className="mt-4 flex gap-3 text-sm">
      {page > 1 && <Link href={qs({ pagina: String(page - 1) })} className="underline">← Mais recentes</Link>}
      {hasMore && <Link href={qs({ pagina: String(page + 1) })} className="underline">Mais antigos →</Link>}
    </div>
  );
}
