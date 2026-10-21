import { redirect } from "next/navigation";
import { signIn, devLoginEnabled } from "@/auth";
import { getCurrentUser } from "@/lib/authz";
import { Logo } from "@/components/logo";
import { btnPrimary, btnSecondary, input } from "@/components/ui";

const ERRORS: Record<string, string> = {
  AccessDenied: "Seu e-mail ainda não foi convidado. Peça acesso a um administrador.",
  CredentialsSignin: "Usuário de desenvolvimento não encontrado.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="hex-grafismo h-2.5 w-full" />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-ink">
            <Logo className="h-10 w-auto" />
          </div>
          <div className="rounded-brand border border-line bg-surface p-7">
            <div className="font-display text-xs font-semibold uppercase tracking-[.08em] text-accent-ink">Proative 2.0</div>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-ink">Portal de governança</h1>
            <p className="mt-1 text-[13px] text-ink-2">Reuniões, atas, plano de ação e biblioteca das diretorias.</p>
            {error && (
              <p className="mt-4 rounded-lg bg-accent-soft p-3 text-[13px] text-accent-ink">{ERRORS[error] ?? "Não foi possível entrar. Tente novamente."}</p>
            )}
            <form
              className="mt-5"
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/" });
              }}
            >
              <button className={`${btnPrimary} w-full`}>Entrar com Microsoft 365</button>
            </form>
            <p className="mt-3 text-center text-xs text-ink-3">Acesso somente para usuários convidados.</p>

            {devLoginEnabled && (
              <form
                className="mt-6 space-y-2 border-t border-dashed border-line pt-4"
                action={async (fd: FormData) => {
                  "use server";
                  await signIn("dev", { email: fd.get("email"), redirectTo: "/" });
                }}
              >
                <p className="text-xs font-semibold text-s6">Login de desenvolvimento (desligado em produção)</p>
                <input name="email" type="email" required placeholder="e-mail de usuário existente" className={input} />
                <button className={`${btnSecondary} w-full`}>Entrar (dev)</button>
              </form>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-ink-3">Proative Soluções em Tecnologia da Informação</p>
        </div>
      </div>
    </main>
  );
}
