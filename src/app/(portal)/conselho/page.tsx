import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { Card, PageHeader } from "@/components/ui";

export default async function ConselhoPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Conselho consultivo" subtitle="Fase 2" />
      <Card>
        <p className="text-sm text-slate-600">Membros, calendário e recomendações do conselho entram na fase 2. Até lá, registre as reuniões do conselho em <Link href="/reunioes/nova" className="underline">Reuniões e atas</Link> com o tipo “Conselho consultivo”.</p>
      </Card>
    </>
  );
}
