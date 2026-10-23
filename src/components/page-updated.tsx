"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Mostra quando a página foi carregada do servidor e permite atualizar. */
export function PageUpdated({ renderedAt }: { renderedAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ago, setAgo] = useState("");
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.round((Date.now() - new Date(renderedAt).getTime()) / 1000));
      setAgo(s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.floor(s / 60)} min` : `há ${Math.floor(s / 3600)} h`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [renderedAt]);
  const time = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(renderedAt));
  return (
    <div className="mb-3 flex items-center justify-end gap-2 text-[11px] text-ink-3">
      <span>Atualizado em {time}{ago && ` · ${ago}`}</span>
      <button type="button" onClick={() => start(() => router.refresh())} disabled={pending} className="rounded border border-line px-2 py-0.5 font-display font-semibold text-ink-2 hover:border-accent hover:text-ink disabled:opacity-50">
        {pending ? "Atualizando…" : "Atualizar"}
      </button>
    </div>
  );
}
