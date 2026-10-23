import { createMeeting } from "@/actions/meetings";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { MeetingFields } from "@/components/meeting-form";
import { btnPrimary, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function NovaReuniaoPage() {
  const user = await requireUser();
  const directorates = await directoratesFor(user, "edit");
  if (!isAdmin(user) && user.role === "LEITOR") notFound();
  return (
    <>
      <PageHeader title="Nova reunião" subtitle="A ata é criada em branco junto com a reunião." />
      <Card>
        <form action={createMeeting} className="space-y-4">
          <MeetingFields directorates={directorates} />
          <SubmitButton className={btnPrimary} pendingText="Criando…">Criar reunião</SubmitButton>
        </form>
      </Card>
    </>
  );
}
