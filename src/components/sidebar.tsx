"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; phase2?: boolean; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Painel geral" },
  { href: "/reunioes", label: "Reuniões e atas" },
  { href: "/acoes", label: "Plano de ação" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/diretorias", label: "Diretorias" },
  { href: "/conselho", label: "Conselho consultivo", phase2: true },
  { href: "/consultoria", label: "Consultoria", phase2: true },
  { href: "/historico", label: "Histórico" },
  { href: "/admin", label: "Administração", adminOnly: true },
];

export function Sidebar({ userName, roleLabel, isAdmin, signOutAction }: {
  userName: string;
  roleLabel: string;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold text-[var(--brand)]">Proative 2.0</span>
        <button onClick={() => setOpen(!open)} className="rounded-md border border-slate-300 px-3 py-1 text-sm" aria-expanded={open}>
          Menu
        </button>
      </header>
      <aside
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 flex-col bg-[var(--brand)] text-white lg:flex`}
      >
        <div className="flex h-full flex-col">
          <div className="px-5 py-5">
            <div className="text-lg font-semibold">Proative 2.0</div>
            <div className="text-xs text-white/60">Portal de governança</div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
            {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  active(i.href) ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {i.label}
                {i.phase2 && <span className="rounded bg-white/15 px-1.5 text-[10px] uppercase">fase 2</span>}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-4 text-sm">
            <div className="truncate font-medium">{userName}</div>
            <div className="text-xs text-white/60">{roleLabel}</div>
            <form action={signOutAction}>
              <button className="mt-2 text-xs text-white/70 underline hover:text-white">Sair</button>
            </form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
