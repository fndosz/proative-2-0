import { notFound } from "next/navigation";
import { createNote } from "@/actions/notes";
import { requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { NoteFields } from "@/components/note-form";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, Card, PageHeader } from "@/components/ui";

export default async function NovaAnotacaoPage() {
  const user = await requireUser();
  if (user.role === "LEITOR") notFound();
  const directorates = await directoratesFor(user, "edit");
  return (
    <>
      <PageHeader eyebrow="Anotações" title="Nova anotação" subtitle="Para reuniões ou conversas sem ata formal. Registre os pontos abordados em texto livre." />
      <Card>
        <form action={createNote} className="space-y-4">
          <NoteFields directorates={directorates} />
          <SubmitButton className={btnPrimary} pendingText="Salvando…">Salvar anotação</SubmitButton>
        </form>
      </Card>
    </>
  );
}
