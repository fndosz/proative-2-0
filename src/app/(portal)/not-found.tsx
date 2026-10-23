import Link from "next/link";
import { btnSecondary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="font-display text-xs font-semibold uppercase tracking-[.08em] text-accent-ink">Erro 404</div>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">Página não encontrada</h1>
      <p className="mt-2 text-[13px] text-ink-2">O endereço não existe ou você não tem permissão para ver este conteúdo. Se precisar de acesso, fale com um administrador.</p>
      <Link href="/" className={`${btnSecondary} mt-6`}>Voltar ao painel</Link>
    </div>
  );
}
