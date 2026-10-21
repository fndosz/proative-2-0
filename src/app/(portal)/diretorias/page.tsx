import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { db } from "@/lib/db";
import { Empty, PageHeader } from "@/components/ui";

export default async function DiretoriasPage() {
  const user = await requireUser();
  const dirs = await directoratesFor(user);
  const counts = await db.actionItem.groupBy({ by: ["directorateId"], where: { status: { not: "CONCLUIDA" }, directorateId: { in: dirs.map((d) => d.id) } }, _count: true });
  return (
    <>
      <PageHeader title="Diretorias" />
      {dirs.length === 0 ? <Empty>Você ainda não está vinculado a nenhuma diretoria. Fale com um administrador.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dirs.map((d) => (
            <Link key={d.id} href={`/diretorias/${d.slug}`} className="rounded-brand border border-line bg-surface p-5 hover:border-accent">
              <div className="text-lg font-semibold">{d.name}</div>
              <div className="mt-1 text-sm text-ink-3">{counts.find((c) => c.directorateId === d.id)?._count ?? 0} ações abertas</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
