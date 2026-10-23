"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/actions/profile";
import { Avatar } from "./avatar";
import { btnPrimary, Field, input } from "./ui";

function Save() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={btnPrimary}>{pending ? "Salvando…" : "Salvar perfil"}</button>;
}

export function ProfileForm({ name, email, hasPhoto, photoUrl }: { name: string; email: string; hasPhoto: boolean; photoUrl: string | null }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || email} src={photoUrl} size={72} />
        <div className="space-y-1 text-[13px]">
          <label className="block">
            <span className="mb-1 block font-semibold text-ink-2">Foto (JPG, PNG ou WebP, até 3 MB)</span>
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="text-[13px]" />
          </label>
          {hasPhoto && <label className="flex items-center gap-2 text-ink-2"><input type="checkbox" name="removePhoto" /> Remover a foto atual</label>}
        </div>
      </div>
      <Field label="Nome"><input name="name" defaultValue={name} required className={input} /></Field>
      <Field label="E-mail" hint="Vem da conta Microsoft 365 e não pode ser alterado aqui."><input value={email} disabled className={`${input} opacity-70`} /></Field>
      {state?.error && <p className="rounded-lg bg-accent-soft p-2 text-[13px] text-accent-ink">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-s4/10 p-2 text-[13px] text-s4">{state.ok}</p>}
      <Save />
    </form>
  );
}
