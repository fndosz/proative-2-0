import { redirect } from "next/navigation";
import { signIn, devLoginEnabled } from "@/auth";
import { getCurrentUser } from "@/lib/authz";
import { btnPrimary, btnSecondary, input } from "@/components/ui";

const ERRORS: Record<string, string> = {
  AccessDenied: "Seu e-mail ainda não foi convidado. Peça acesso a um administrador.",
  CredentialsSignin: "Usuário de desenvolvimento não encontrado.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand)] text-lg font-bold text-white">P</div>
          <h1 className="text-xl font-semibold">Proative 2.0</h1>
          <p className="text-sm text-slate-500">Portal privado de governança</p>
        </div>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error] ?? "Não foi possível entrar. Tente novamente."}</p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button className={`${btnPrimary} w-full`}>Entrar com Microsoft 365</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Acesso somente para usuários convidados.</p>

        {devLoginEnabled && (
          <form
            className="mt-6 space-y-2 border-t border-dashed border-slate-300 pt-4"
            action={async (fd: FormData) => {
              "use server";
              await signIn("dev", { email: fd.get("email"), redirectTo: "/" });
            }}
          >
            <p className="text-xs font-medium text-amber-700">Login de desenvolvimento (desligado em produção)</p>
            <input name="email" type="email" required placeholder="e-mail de usuário existente" className={input} />
            <button className={`${btnSecondary} w-full`}>Entrar (dev)</button>
          </form>
        )}
      </div>
    </main>
  );
}
