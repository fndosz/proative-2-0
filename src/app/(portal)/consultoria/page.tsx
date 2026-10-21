import { requireUser } from "@/lib/authz";
import { Card, PageHeader } from "@/components/ui";

export default async function ConsultoriaPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Consultoria" subtitle="Fase 2" />
      <Card>
        <p className="text-sm text-slate-600">Atividades, horas previstas × usadas e periodicidade configurável entram na fase 2.</p>
      </Card>
    </>
  );
}
