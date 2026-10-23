"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ChatState } from "@/actions/ata-chat";
import { btnPrimary, input } from "./ui";

type Msg = { id: string; role: "USER" | "ASSISTANT"; content: string; applied: string[]; at: string };

const QUICK = [
  ["Resumo executivo", "Faça um resumo executivo desta reunião em até 8 linhas, com os principais pontos, decisões e pendências."],
  ["Destacar decisões", "Liste as decisões tomadas e o que ficou pendente, indicando quem é responsável por cada encaminhamento."],
  ["Formalizar tom", "Reescreva as seções Deliberações e Assuntos gerais com tom formal de ata, sem mudar o conteúdo."],
  ["Checar pendências", "Quais pontos estão marcados [a confirmar] ou sem responsável/prazo? O que eu preciso confirmar?"],
];

function Send() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={btnPrimary}>{pending ? "Pensando…" : "Enviar"}</button>;
}

export function AtaChat({ messages, action, clearAction, aiEnabled }: {
  messages: Msg[];
  action: (prev: ChatState, fd: FormData) => Promise<ChatState>;
  clearAction: () => Promise<void>;
  aiEnabled: boolean;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length, pending]);
  useEffect(() => { if (!pending && !state?.error) formRef.current?.reset(); }, [pending, state]);

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-2">
        Peça resumos, destaques ou ajustes (“troque Giancarlo por Giancarlo Rossi”, “formalize o item 2”, “inclua a decisão X”). O assistente lê a ata, a transcrição e os participantes, e aplica as alterações que você pedir.
      </p>
      <div ref={listRef} className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-line bg-surface-2 p-3">
        {messages.length === 0 && <p className="text-center text-[13px] text-ink-3">Nenhuma conversa ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[92%] rounded-lg px-3 py-2 text-[13px] ${m.role === "USER" ? "ml-auto bg-accent-soft text-ink" : "bg-surface text-ink"}`}>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.applied.length > 0 && <div className="mt-1 text-xs text-s4">Aplicado: {m.applied.join(", ")}</div>}
            <div className="mt-1 text-[10px] text-ink-3">{m.at}</div>
          </div>
        ))}
        {pending && <div className="max-w-[92%] rounded-lg bg-surface px-3 py-2 text-[13px] text-ink-3">O assistente está lendo a ata…</div>}
      </div>
      <form ref={formRef} action={submit} className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(([label, prompt]) => (
            <button key={label} type="submit" name="prompt" value={prompt} disabled={pending || !aiEnabled} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:border-accent hover:text-ink disabled:opacity-50">
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input name="prompt" placeholder="O que você quer fazer com a ata?" className={input} disabled={!aiEnabled} autoComplete="off" />
          <Send />
        </div>
        {state?.error && <p className="rounded-lg bg-accent-soft p-2 text-[13px] text-accent-ink">{state.error}</p>}
        {!aiEnabled && <p className="text-xs text-s6">Assistente desligado neste ambiente (falta ANTHROPIC_API_KEY).</p>}
      </form>
      {messages.length > 0 && (
        <form action={clearAction}><button className="text-xs text-ink-3 underline">Limpar conversa</button></form>
      )}
    </div>
  );
}
