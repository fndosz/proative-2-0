import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { inviteUser, revokeInvite, updateUser } from "@/actions/admin";
import { fmtDateTime, ROLE_LABEL } from "@/lib/format";
import { Badge, btnPrimary, btnSecondary, Card, Empty, Field, input, PageHeader } from "@/components/ui";

const ROLE_HELP = {
  ADMIN: "tudo, inclusive usuários e permissões",
  DIRETORIA: "edita e aprova atas nas suas diretorias",
  CONSULTOR: "edita nas diretorias em que tem edição",
  LEITOR: "só leitura",
};

export default async function AdminPage() {
  const me = await requireRole("ADMIN");
  const [users, invites, directorates] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { directorates: true } }),
    db.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    db.directorate.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Administração" subtitle="Usuários, perfis e permissões por diretoria. O acesso é pela conta Microsoft 365 do convidado." />

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
              <legend className="mb-1 text-sm font-medium text-slate-700">Diretorias</legend>
              {directorates.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="directorateIds" value={d.id} /> {d.name}</label>
              ))}
            </fieldset>
            <button className={btnPrimary}>Convidar</button>
            <p className="text-xs text-slate-500">O convidado entra com “Entrar com Microsoft 365”. Nenhum e-mail é enviado automaticamente — avise a pessoa.</p>
          </form>
        </Card>

        <Card title="Convites pendentes" className="lg:col-span-2">
          {invites.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{i.email} <Badge>{ROLE_LABEL[i.role]}</Badge> <span className="text-xs text-slate-500">· {fmtDateTime(i.createdAt)}</span></span>
                  <form action={revokeInvite.bind(null, i.id)}><button className="text-xs text-red-600 underline">Cancelar</button></form>
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhum convite pendente.</Empty>}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Usuários</h2>
      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{u.name ?? u.email}</span>
              <span className="text-slate-500">{u.email}</span>
              <Badge>{ROLE_LABEL[u.role]}</Badge>
              {!u.active && <Badge className="bg-red-100 text-red-800">desativado</Badge>}
              {u.id === me.id && <Badge className="bg-blue-100 text-blue-800">você</Badge>}
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
                <div className="mb-1 text-sm font-medium text-slate-700">Acesso por diretoria</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {directorates.map((d) => {
                    const m = u.directorates.find((x) => x.directorateId === d.id);
                    return (
                      <label key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-sm">
                        {d.name}
                        <select name={`dir_${d.id}`} defaultValue={m?.access ?? ""} className="rounded border border-slate-200 px-1 py-0.5 text-xs">
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

      <Card title="Identidade visual" className="mt-8">
        <p className="text-sm text-slate-600">Cores e logotipo ficam em <code>src/app/globals.css</code> (variáveis <code>--brand</code> e <code>--brand-accent</code>). Envie o manual de marca da Proative para aplicarmos.</p>
      </Card>
    </>
  );
}
