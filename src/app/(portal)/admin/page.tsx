import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { createDirectorate, deleteDirectorate, inviteUser, revokeInvite, updateDirectorate, updateUser } from "@/actions/admin";
import { ConfirmButton, SubmitButton } from "@/components/submit-button";
import { fmtDateTime, ROLE_LABEL } from "@/lib/format";
import Link from "next/link";
import { perfMetrics, portalCounts } from "@/lib/metrics";
import { Badge, btnPrimary, btnSecondary, Card, Empty, Field, input, KpiStrip, PageHeader } from "@/components/ui";

const ROLE_HELP = {
  ADMIN: "tudo, inclusive usuários e permissões",
  DIRETORIA: "edita e aprova atas nas suas diretorias",
  CONSULTOR: "edita nas diretorias em que tem edição",
  LEITOR: "só leitura",
};

const fmtBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);
const ms = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ janela?: string }> }) {
  const me = await requireRole("ADMIN");
  const hours = Number((await searchParams).janela ?? 24) || 24;
  const [users, invites, directorates, perf, counts] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { directorates: true } }),
    db.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    db.directorate.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { meetings: true, actions: true, documents: true, notes: true, members: true } } } }),
    perfMetrics(hours),
    portalCounts(),
  ]);
  const slowTone = (v: number | null) => (v == null ? "accent" : v > 2000 ? "critical" : v > 800 ? "accent" : "good");

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Indicadores e usuários"
        subtitle="Desempenho e uso do portal, usuários, perfis e permissões por diretoria."
        actions={
          <>
            {[24, 168, 720].map((h) => (
              <Link key={h} href={`/admin?janela=${h}`} className={hours === h ? "rounded-lg bg-ink px-3 py-2 text-sm text-white" : btnSecondary}>
                {h === 24 ? "24 h" : h === 168 ? "7 dias" : "30 dias"}
              </Link>
            ))}
            <Link href="/admin/logs" className={btnSecondary}>Ver logs</Link>
          </>
        }
      />

      <div className="mb-4">
        <KpiStrip
          items={[
            { label: "Requisições", value: perf.requests, detail: `${perf.users} usuário(s) ativos` },
            { label: "Tempo médio", value: ms(perf.avgMs), detail: "resposta do servidor", tone: slowTone(perf.avgMs) },
            { label: "P95", value: ms(perf.p95Ms), detail: "95% abaixo disto", tone: slowTone(perf.p95Ms) },
            { label: "Erros", value: perf.errors, tone: perf.errors ? "critical" : "good", detail: perf.requests ? `${((perf.errors / perf.requests) * 100).toFixed(1)}% das requisições` : undefined },
            { label: "Atas com IA", value: perf.ai.runs, detail: `US$ ${(perf.ai.costCents / 100).toFixed(2)} · média ${ms(perf.ai.avgMs)}` },
          ]}
        />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card title="Tempo por rota" className="lg:col-span-2">
          {perf.routes.length === 0 ? <Empty>Sem acessos na janela.</Empty> : (
            <table className="w-full text-[13px]">
              <thead className="text-left font-display text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
                <tr><th className="py-1">Rota</th><th className="text-right">Req.</th><th className="text-right">Média</th><th className="text-right">P95</th><th className="text-right">Erros</th></tr>
              </thead>
              <tbody className="divide-y divide-grid">
                {perf.routes.map((r) => (
                  <tr key={r.path}>
                    <td className="py-1.5 font-mono text-xs">{r.path}</td>
                    <td className="num text-right">{r.requests}</td>
                    <td className={`num text-right ${r.avgMs > 2000 ? "text-critical" : ""}`}>{ms(r.avgMs)}</td>
                    <td className={`num text-right ${r.p95Ms > 2000 ? "text-critical" : ""}`}>{ms(r.p95Ms)}</td>
                    <td className={`num text-right ${r.errors ? "text-critical" : "text-ink-3"}`}>{r.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Volume do portal">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-ink-3">Usuários ativos</dt><dd className="num text-right">{counts.users}</dd>
              <dt className="text-ink-3">Reuniões</dt><dd className="num text-right">{counts.meetings}</dd>
              <dt className="text-ink-3">Ações abertas</dt><dd className="num text-right">{counts.actions}</dd>
              <dt className="text-ink-3">Documentos</dt><dd className="num text-right">{counts.documents}</dd>
              <dt className="text-ink-3">Arquivos</dt><dd className="num text-right">{fmtBytes(counts.storageBytes)}</dd>
              <dt className="text-ink-3">Eventos de auditoria</dt><dd className="num text-right">{counts.audit}</dd>
              <dt className="text-ink-3">Registros de acesso</dt><dd className="num text-right">{counts.logs}</dd>
            </dl>
          </Card>
          <Card title="Usuários mais ativos">
            {perf.activeUsers.length === 0 ? <Empty>—</Empty> : (
              <ul className="space-y-1 text-[13px]">
                {perf.activeUsers.map((u) => (
                  <li key={u.email} className="flex justify-between gap-2"><span className="truncate">{u.name ?? u.email}</span><span className="num text-ink-3">{u.requests} · {fmtDateTime(u.last)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Requisições mais lentas">
          {perf.slowest.length === 0 ? <Empty>—</Empty> : (
            <ul className="space-y-1 text-[13px]">
              {perf.slowest.map((s, i) => (
                <li key={i} className="flex justify-between gap-2"><span className="truncate font-mono text-xs">{s.path}{s.name ? ` · ${s.name}` : ""}</span><span className="num shrink-0 text-ink-3">{ms(s.durationMs)}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Erros recentes" className="lg:col-span-2">
          {perf.errorsRecent.length === 0 ? <Empty>Nenhum erro na janela.</Empty> : (
            <ul className="space-y-1 text-[13px]">
              {perf.errorsRecent.map((e, i) => (
                <li key={i}><span className="text-ink-3">{fmtDateTime(e.createdAt)}</span> · <span className="font-mono text-xs">{e.path}</span> — <span className="text-critical">{e.error}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-3">Métricas de navegador (Web Vitals) e analytics ficam no painel da Vercel: Speed Insights e Analytics do projeto.</p>
        </Card>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Usuários e permissões</h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Convidar usuário" className="lg:col-span-1">
          <form action={inviteUser} className="space-y-3">
            <Field label="E-mail Microsoft 365"><input name="email" type="email" required className={input} placeholder="nome@proativetec.com.br" /></Field>
            <Field label="Perfil">
              <select name="role" className={input} defaultValue="LEITOR">
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v} — {ROLE_HELP[k as keyof typeof ROLE_HELP]}</option>)}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-ink">Diretorias</legend>
              {directorates.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="directorateIds" value={d.id} /> {d.name}</label>
              ))}
            </fieldset>
            <button className={btnPrimary}>Convidar</button>
            <p className="text-xs text-ink-3">O convidado entra com “Entrar com Microsoft 365”. Nenhum e-mail é enviado automaticamente — avise a pessoa.</p>
          </form>
        </Card>

        <Card title="Convites pendentes" className="lg:col-span-2">
          {invites.length ? (
            <ul className="divide-y divide-grid text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{i.email} <Badge>{ROLE_LABEL[i.role]}</Badge> <span className="text-xs text-ink-3">· {fmtDateTime(i.createdAt)}</span></span>
                  <form action={revokeInvite.bind(null, i.id)}><button className="text-xs text-accent-ink underline">Cancelar</button></form>
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhum convite pendente.</Empty>}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Usuários</h2>
      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="rounded-brand border border-line bg-surface p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{u.name ?? u.email}</span>
              <span className="text-ink-3">{u.email}</span>
              <Badge>{ROLE_LABEL[u.role]}</Badge>
              {!u.active && <Badge className="bg-accent-soft text-accent-ink">desativado</Badge>}
              {u.id === me.id && <Badge className="bg-s2/12 text-s2">você</Badge>}
            </summary>
            <form action={updateUser.bind(null, u.id)} className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Perfil">
                <select name="role" defaultValue={u.role} className={input}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Ativo</label>
              <div />
              <div className="md:col-span-3">
                <div className="mb-1 text-sm font-medium text-ink">Acesso por diretoria</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {directorates.map((d) => {
                    const m = u.directorates.find((x) => x.directorateId === d.id);
                    return (
                      <label key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-grid px-3 py-1.5 text-sm">
                        {d.name}
                        <select name={`dir_${d.id}`} defaultValue={m?.access ?? ""} className="rounded border border-line px-1 py-0.5 text-xs">
                          <option value="">sem acesso</option>
                          <option value="LEITURA">leitura</option>
                          <option value="EDICAO">edição</option>
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div><button className={btnSecondary}>Salvar alterações</button></div>
            </form>
          </details>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Diretorias</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Nova diretoria">
          <form action={createDirectorate} className="space-y-3">
            <Field label="Nome"><input name="name" required className={input} placeholder="Ex.: Parceria / Produto" /></Field>
            <Field label="Descrição (opcional)"><input name="description" className={input} /></Field>
            <SubmitButton className={btnPrimary} pendingText="Criando…">Criar diretoria</SubmitButton>
          </form>
        </Card>
        <Card title="Diretorias existentes" className="lg:col-span-2">
          <ul className="divide-y divide-grid">
            {directorates.map((d) => {
              const linked = d._count.meetings + d._count.actions + d._count.documents + d._count.notes;
              return (
                <li key={d.id} className="py-3">
                  <form action={updateDirectorate.bind(null, d.id)} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_80px_auto]">
                    <Field label="Nome"><input name="name" defaultValue={d.name} required className={input} /></Field>
                    <Field label="Descrição"><input name="description" defaultValue={d.description ?? ""} className={input} /></Field>
                    <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={d.sortOrder} className={input} /></Field>
                    <div className="flex gap-2 pb-0.5">
                      <SubmitButton className={btnSecondary} pendingText="…">Salvar</SubmitButton>
                    </div>
                  </form>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-3">
                    <span>{d._count.members} membro(s) · {d._count.meetings} reuniões · {d._count.actions} ações · {d._count.documents} documentos · {d._count.notes} anotações · endereço /diretorias/{d.slug}</span>
                    {linked === 0 && (
                      <form action={deleteDirectorate.bind(null, d.id)}>
                        <ConfirmButton className="text-accent-ink hover:underline" message={`Remover a diretoria "${d.name}"?`}>Remover</ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="Identidade visual" className="mt-8">
        <p className="text-sm text-ink-2">Cores, fontes e logotipo seguem o brandbook Proative 2.0 (tokens em <code>src/app/globals.css</code>, logo em <code>src/components/logo.tsx</code>).</p>
      </Card>
    </>
  );
}
