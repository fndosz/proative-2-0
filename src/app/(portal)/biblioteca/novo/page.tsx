import { createDocument } from "@/actions/documents";
import { requireUser } from "@/lib/authz";
import { directoratesFor } from "@/lib/directorates";
import { btnPrimary, Card, Field, input, PageHeader } from "@/components/ui";

export default async function NovoDocumentoPage({ searchParams }: { searchParams: Promise<{ meetingId?: string }> }) {
  const { meetingId } = await searchParams;
  const user = await requireUser();
  const directorates = await directoratesFor(user, "edit");
  return (
    <>
      <PageHeader title="Enviar documento" subtitle="Novas versões do mesmo documento são enviadas na página dele." />
      <Card>
        <form action={createDocument} className="grid gap-4 md:grid-cols-2">
          {meetingId && <input type="hidden" name="meetingId" value={meetingId} />}
          <div className="md:col-span-2"><Field label="Arquivo" hint="Até 50 MB."><input type="file" name="file" required className="text-sm" /></Field></div>
          <Field label="Título" hint="Se vazio, usa o nome do arquivo."><input name="title" className={input} /></Field>
          <Field label="Diretoria">
            <select name="directorateId" className={input} defaultValue="">
              <option value="">Geral</option>
              {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2"><Field label="Descrição"><textarea name="description" rows={3} className={input} /></Field></div>
          <Field label="Etiquetas" hint="Separadas por vírgula."><input name="tags" className={input} placeholder="contrato, 2026" /></Field>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="restricted" /> Restrito (só pessoas escolhidas)</label>
          <div className="md:col-span-2"><button className={btnPrimary}>Enviar</button></div>
        </form>
      </Card>
    </>
  );
}
