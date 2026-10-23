import { createAction } from "@/actions/action-items";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/authz";
import { activeUsers, directoratesFor } from "@/lib/directorates";
import { ActionFields } from "@/components/action-form";
import { btnPrimary, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function NovaAcaoPage() {
  const user = await requireUser();
  const [directorates, users] = await Promise.all([directoratesFor(user, "edit"), activeUsers()]);
  if (!isAdmin(user) && user.role === "LEITOR") notFound();
  return (
    <>
      <PageHeader title="Nova ação" />
      <Card>
        <form action={createAction} className="space-y-4">
          <ActionFields directorates={directorates} users={users} />
          <SubmitButton className={btnPrimary} pendingText="Criando…">Criar ação</SubmitButton>
        </form>
      </Card>
    </>
  );
}
