"use client";

import { useTransition } from "react";
import { setTheme } from "@/actions/profile";

const OPTIONS = [["light", "Claro"], ["dark", "Escuro"], ["system", "Sistema"]] as const;

export function ThemeToggle({ current }: { current: "light" | "dark" | "system" }) {
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Tema">
      {OPTIONS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          disabled={pending}
          onClick={() => {
            if (value === "system") document.documentElement.removeAttribute("data-theme");
            else document.documentElement.setAttribute("data-theme", value);
            start(() => setTheme(value));
          }}
          className={`rounded-md px-2 py-1 font-display text-[11px] font-semibold ${current === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
