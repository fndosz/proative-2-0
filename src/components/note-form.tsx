import type { Directorate, Note } from "@prisma/client";
import { toDateTimeInput } from "@/lib/format";
import { Field, input } from "./ui";

export function NoteFields({ directorates, note }: { directorates: Directorate[]; note?: Note }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Field label="Título"><input name="title" required defaultValue={note?.title} className={input} placeholder="Ex.: Conversa com a Alfa Tech sobre o contrato" /></Field>
      </div>
      <Field label="Data e hora"><input name="date" type="datetime-local" required defaultValue={toDateTimeInput(note?.date ?? new Date())} className={input} /></Field>
      <Field label="Diretoria">
        <select name="directorateId" defaultValue={note?.directorateId ?? ""} className={input}>
          <option value="">Geral (todas)</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Quem participou" hint="Nomes separados por vírgula."><input name="participants" defaultValue={note?.participants ?? ""} className={input} placeholder="Fernando, Giancarlo, Mariana" /></Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Pontos abordados" hint="Texto livre: o que foi discutido, combinado, pendências. Pode ser em tópicos.">
          <textarea name="body" rows={12} required defaultValue={note?.body} className={input} placeholder={"- Resultado de setembro acima da meta\n- Cláusula de exclusividade na minuta: pedir retirada\n- Giancarlo leva ao jurídico até dia 30"} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Etiquetas" hint="Separadas por vírgula."><input name="tags" defaultValue={note?.tags.join(", ")} className={input} placeholder="parceria, contrato" /></Field>
      </div>
    </div>
  );
}
