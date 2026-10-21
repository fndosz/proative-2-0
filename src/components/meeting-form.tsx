import type { Directorate, Meeting } from "@prisma/client";
import { Field, input } from "./ui";
import { MEETING_STATUS_LABEL, toDateTimeInput } from "@/lib/format";

export const MEETING_TYPES = ["Conselho consultivo", "Reunião de diretoria", "Consultoria", "Reunião geral"];

export function MeetingFields({ directorates, meeting }: { directorates: Directorate[]; meeting?: Meeting }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Field label="Título">
          <input name="title" required defaultValue={meeting?.title} className={input} placeholder="Ex.: Reunião do conselho — outubro" />
        </Field>
      </div>
      <Field label="Tipo">
        <select name="type" defaultValue={meeting?.type ?? MEETING_TYPES[0]} className={input}>
          {MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Data e hora">
        <input name="date" type="datetime-local" required defaultValue={toDateTimeInput(meeting?.date)} className={input} />
      </Field>
      <Field label="Local ou link">
        <input name="location" defaultValue={meeting?.location ?? ""} className={input} placeholder="Sala / Teams" />
      </Field>
      <Field label="Diretoria">
        <select name="directorateId" defaultValue={meeting?.directorateId ?? ""} className={input}>
          <option value="">Geral (todas)</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {meeting && (
        <Field label="Situação">
          <select name="status" defaultValue={meeting.status} className={input}>
            {Object.entries(MEETING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}
