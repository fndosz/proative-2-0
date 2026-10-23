import { requireUser } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/format";
import { ProfileForm } from "@/components/profile-form";
import { Card, PageHeader } from "@/components/ui";

export default async function PerfilPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Minha conta" title="Meu perfil" subtitle={`${user.email} · ${ROLE_LABEL[user.role]}`} />
      <Card className="max-w-xl">
        <ProfileForm name={user.name ?? ""} email={user.email} hasPhoto={Boolean(user.image)} photoUrl={user.image ? `/api/avatar/${user.id}?v=${Date.parse(user.updatedAt.toISOString())}` : null} />
      </Card>
    </>
  );
}
