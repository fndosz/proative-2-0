"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";

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
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="text-ink"><Logo className="h-7 w-auto" /></Link>
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-line px-3 py-1 font-display text-sm font-semibold text-ink-2" aria-expanded={open}>
          Menu
        </button>
      </header>
      <aside className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-surface lg:block`}>
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-5 py-5 text-ink">
            <Logo className="h-9 w-auto" />
            <div className="mt-2 font-display text-xs font-semibold uppercase tracking-[.08em] text-ink-3">Portal de governança</div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-lg border-l-2 px-3 py-2 font-display text-sm ${
                  active(i.href)
                    ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                    : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {i.label}
                {i.phase2 && <span className="rounded bg-surface-2 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">fase 2</span>}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line px-5 py-4 text-sm">
            <div className="truncate font-display font-semibold text-ink">{userName}</div>
            <div className="text-xs text-ink-3">{roleLabel}</div>
            <form action={signOutAction}>
              <button className="mt-2 text-xs text-accent-ink hover:underline">Sair</button>
            </form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
