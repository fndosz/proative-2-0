import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="font-display text-xs font-semibold uppercase tracking-[.08em] text-accent-ink">{eyebrow}</div>}
        <h1 className="font-display text-[28px] font-bold leading-[1.05] text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[70ch] text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className = "" }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-brand border border-line bg-surface p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Faixa de indicadores no padrão do painel executivo Proative. */
export function KpiStrip({ items }: { items: { label: string; value: ReactNode; detail?: string; tone?: "accent" | "critical" | "good" }[] }) {
  const tone = { accent: "text-ink", critical: "text-critical", good: "text-good" };
  const cols = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4", "md:grid-cols-5"][Math.min(items.length, 5)];
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-brand border border-line bg-line ${cols}`}>
      {items.map((k) => (
        <div key={k.label} className="flex min-w-0 flex-col gap-1 bg-surface px-4 pb-3 pt-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">{k.label}</div>
          <div className={`num font-display text-[30px] font-bold leading-[1.1] ${tone[k.tone ?? "accent"]}`}>{k.value}</div>
          {k.detail && <div className="text-xs text-ink-2">{k.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-center text-[13px] text-ink-3">{children}</p>;
}

export function Badge({ children, className = "bg-surface-2 text-ink-2" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[.06em] ${className}`}>{children}</span>;
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-accent px-3.5 py-2 font-display text-sm font-semibold text-white hover:bg-accent-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 font-display text-sm font-semibold text-ink-2 hover:border-accent hover:text-ink";
export const btnDanger =
  "inline-flex items-center justify-center rounded-lg border border-accent/40 bg-surface px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft";
export const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
export const label = "mb-1 block text-[13px] font-semibold text-ink-2";

export function Field({ label: l, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={label}>{l}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
