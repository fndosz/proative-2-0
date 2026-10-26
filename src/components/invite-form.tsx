"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { inviteUser } from "@/actions/admin";
import { btnPrimary, Field, input } from "./ui";

function Send() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={btnPrimary}>{pending ? "Convidando…" : "Convidar"}</button>;
}

export function InviteForm({ roles, directorates }: { roles: [string, string][]; directorates: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(inviteUser, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!pending && state?.ok) ref.current?.reset(); }, [pending, state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="E-mail Microsoft 365"><input name="email" type="email" required className={input} placeholder="nome@proativetec.com.br" autoComplete="off" /></Field>
      <Field label="Perfil">
        <select name="role" className={input} defaultValue="LEITOR">
          {roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Diretorias</legend>
        {directorates.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="directorateIds" value={d.id} /> {d.name}</label>
        ))}
      </fieldset>
      <Send />
      {state?.error && <p className="rounded-lg bg-accent-soft p-2 text-[13px] text-accent-ink">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-s4/10 p-2 text-[13px] text-s4">{state.ok}</p>}
      <p className="text-xs text-ink-3">Nenhum e-mail é enviado automaticamente — avise a pessoa. O convite fica pendente até o primeiro login e some da lista quando aceito.</p>
    </form>
  );
}
