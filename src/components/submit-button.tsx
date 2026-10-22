"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que desabilita enquanto a ação roda — evita registros duplicados por clique duplo. */
export function SubmitButton({ children, className, pendingText = "Salvando…" }: { children: React.ReactNode; className: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botão de ação destrutiva com confirmação. */
export function ConfirmButton({ children, className, message, pendingText = "Aguarde…" }: { children: React.ReactNode; className: string; message: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
