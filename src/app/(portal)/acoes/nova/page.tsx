import { createAction } from "@/actions/action-items";
import { requireUser } from "@/lib/authz";
import { activeUsers, directoratesFor } from "@/lib/directorates";
import { ActionFields } from "@/components/action-form";
import { btnPrimary, Card, PageHeader } from "@/components/ui";

export default async function NovaAcaoPage() {
  const user = await requireUser();
  const [directorates, users] = await Promise.all([directoratesFor(user, "edit"), activeUsers()]);
  return (
    <>
      <PageHeader title="Nova ação" />
      <Card>
        <form action={createAction} className="space-y-4">
          <ActionFields directorates={directorates} users={users} />
          <button className={btnPrimary}>Criar ação</button>
        </form>
      </Card>
    </>
  );
}
