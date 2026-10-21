"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setActionStatus } from "@/actions/action-items";

type Card = { id: string; title: string; status: string; owner: string | null; due: string | null; overdue: boolean; priority: string; editable: boolean };

const COLUMNS = [
  ["NAO_INICIADA", "Não iniciada"],
  ["EM_ANDAMENTO", "Em andamento"],
  ["BLOQUEADA", "Bloqueada"],
  ["CONCLUIDA", "Concluída"],
] as const;

export function Kanban({ cards }: { cards: Card[] }) {
  const [, start] = useTransition();
  const [items, move] = useOptimistic(cards, (state, { id, status }: { id: string; status: string }) =>
    state.map((c) => (c.id === id ? { ...c, status } : c)),
  );

  function drop(e: React.DragEvent, status: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const card = items.find((c) => c.id === id);
    if (!card || card.status === status || !card.editable) return;
    start(async () => {
      move({ id, status });
      await setActionStatus(id, status);
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map(([status, label]) => {
        const col = items.filter((c) => c.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, status)}
            className="min-h-40 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="mb-2 flex justify-between text-xs font-semibold uppercase text-slate-500">
              <span>{label}</span><span>{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((c) => (
                <div
                  key={c.id}
                  draggable={c.editable}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  className={`rounded-lg border bg-white p-3 text-sm shadow-sm ${c.editable ? "cursor-grab" : ""} ${c.overdue ? "border-red-300" : "border-slate-200"}`}
                >
                  <Link href={`/acoes/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <span>{c.owner ?? "Sem responsável"}</span>
                    {c.due && <span className={c.overdue ? "font-medium text-red-600" : ""}>{c.due}</span>}
                    <span>{c.priority}</span>
                  </div>
                  {c.editable && (
                    <select
                      aria-label="Mover para"
                      className="mt-2 w-full rounded border border-slate-200 px-1 py-0.5 text-xs md:hidden"
                      value={c.status}
                      onChange={(e) => {
                        const status = e.target.value;
                        start(async () => { move({ id: c.id, status }); await setActionStatus(c.id, status); });
                      }}
                    >
                      {COLUMNS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
