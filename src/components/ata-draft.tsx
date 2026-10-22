"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/ata-draft";
import { btnPrimary, btnSecondary, input } from "./ui";

type Props = {
  transcript: string;
  updatedAt: string | null;
  aiEnabled: boolean;
  aiInfo: string | null;
  saveAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  generateAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
};

function Submit({ formAction, className, children, pendingText }: { formAction: (fd: FormData) => void; className: string; children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button formAction={formAction} disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function AtaDraft({ transcript, updatedAt, aiEnabled, aiInfo, saveAction, generateAction }: Props) {
  const [saveState, save] = useActionState(saveAction, null);
  const [genState, generate, generating] = useActionState(generateAction, null);
  const state = genState ?? saveState;

  return (
    <form className="space-y-3">
      <p className="text-[13px] text-ink-2">
        Cole aqui a transcrição exportada do Plaud ou suas anotações livres. O texto fica guardado no histórico e serve de base para a ata.
      </p>
      <textarea
        name="transcript"
        rows={12}
        defaultValue={transcript}
        placeholder={"Ex.:\n[00:00] Fernando: Bom dia a todos, vamos começar pela pauta de parcerias…\n[03:12] Giancarlo: Sobre o contrato com a X, proponho…"}
        className={`${input} font-mono text-[13px]`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Submit formAction={save} className={btnSecondary} pendingText="Salvando…">Salvar rascunho</Submit>
        <Submit formAction={generate} className={btnPrimary} pendingText="Gerando ata… isso leva até um minuto">Gerar ata com IA</Submit>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" name="overwrite" /> Substituir o texto atual da ata
        </label>
        {updatedAt && <span className="ml-auto text-xs text-ink-3">Rascunho salvo em {updatedAt}</span>}
      </div>
      {!aiEnabled && (
        <p className="rounded-lg bg-warning/15 p-3 text-[13px] text-s6">
          A geração automática está desligada: falta a chave <code>ANTHROPIC_API_KEY</code> nas variáveis do projeto na Vercel. O rascunho pode ser salvo normalmente.
        </p>
      )}
      {generating && (
        <p className="rounded-lg bg-s2/10 p-3 text-[13px] text-s2">O Claude está lendo a transcrição e redigindo a ata no modelo Proative. Não feche a página.</p>
      )}
      {state?.error && <p className="rounded-lg bg-accent-soft p-3 text-[13px] text-accent-ink">{state.error}</p>}
      {state?.ok && !generating && <p className="rounded-lg bg-s4/10 p-3 text-[13px] text-s4">{state.ok}</p>}
      {aiInfo && <p className="text-xs text-ink-3">{aiInfo}</p>}
      <p className="text-xs text-ink-3">
        Regras: o Claude usa só o que está no texto; pontos sem clareza saem marcados como <b>[a confirmar]</b>. A ata gerada é um rascunho e só vale depois de revisada e aprovada.
      </p>
    </form>
  );
}
