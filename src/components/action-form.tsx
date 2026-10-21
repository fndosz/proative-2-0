import type { ActionItem, Directorate } from "@prisma/client";
import { ACTION_STATUS_LABEL, PRIORITY_LABEL, toDateInput } from "@/lib/format";
import { Field, input } from "./ui";

export function ActionFields({ directorates, users, action }: {
  directorates: Directorate[];
  users: { id: string; name: string | null; email: string }[];
  action?: ActionItem;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Field label="Título"><input name="title" required defaultValue={action?.title} className={input} /></Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Descrição"><textarea name="description" rows={4} defaultValue={action?.description ?? ""} className={input} /></Field>
      </div>
      <Field label="Responsável">
        <select name="ownerId" defaultValue={action?.ownerId ?? ""} className={input}>
          <option value="">—</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
        </select>
      </Field>
      <Field label="Prazo"><input type="date" name="dueDate" defaultValue={toDateInput(action?.dueDate)} className={input} /></Field>
      <Field label="Situação">
        <select name="status" defaultValue={action?.status ?? "NAO_INICIADA"} className={input}>
          {Object.entries(ACTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Prioridade">
        <select name="priority" defaultValue={action?.priority ?? "MEDIA"} className={input}>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Diretoria">
        <select name="directorateId" defaultValue={action?.directorateId ?? ""} className={input}>
          <option value="">Geral</option>
          {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
