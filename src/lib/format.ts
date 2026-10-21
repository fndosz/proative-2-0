import type { ActionStatus, MeetingStatus, MinutesStatus, Priority, Role } from "@prisma/client";

const TZ = "America/Sao_Paulo";

export const fmtDate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ }).format(d) : "—";

export const fmtDateTime = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(d) : "—";

/** Valor para <input type="date"> */
export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Valor para <input type="datetime-local"> no fuso de São Paulo */
export function toDateTimeInput(d: Date | null | undefined) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(d);
  return parts.replace(" ", "T");
}

/** "2026-10-21T14:00" digitado em São Paulo → Date */
export function parseLocalDateTime(v: string) {
  return new Date(`${v}:00-03:00`);
}

export function parseDate(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s ? new Date(`${s}T12:00:00-03:00`) : null;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  DIRETORIA: "Diretoria",
  CONSULTOR: "Consultor",
  LEITOR: "Leitor",
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA: "Bloqueada",
  CONCLUIDA: "Concluída",
};

export const ACTION_STATUS_COLOR: Record<ActionStatus, string> = {
  NAO_INICIADA: "bg-surface-2 text-ink-2",
  EM_ANDAMENTO: "bg-s2/12 text-s2",
  BLOQUEADA: "bg-critical/12 text-critical",
  CONCLUIDA: "bg-s4/12 text-s4",
};

export const PRIORITY_LABEL: Record<Priority, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta" };

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const MINUTES_STATUS_LABEL: Record<MinutesStatus, string> = {
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
};

export function startOfToday() {
  const d = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: TZ })}T00:00:00-03:00`);
  return d;
}

export const isOverdue = (due: Date | null, status: ActionStatus) =>
  Boolean(due && status !== "CONCLUIDA" && due < startOfToday());
