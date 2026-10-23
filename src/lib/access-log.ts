import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import type { AccessKind } from "@prisma/client";
import { db } from "./db";

type Entry = {
  userId?: string | null;
  kind: AccessKind;
  path: string;
  name?: string | null;
  status?: number;
  durationMs?: number | null;
  error?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** Grava sem bloquear a resposta; falha de log nunca derruba a página. */
export function writeAccessLog(entry: Entry) {
  const data = { ...entry, error: entry.error?.slice(0, 500) ?? null, userAgent: entry.userAgent?.slice(0, 300) ?? null };
  const run = () => db.accessLog.create({ data }).catch((e) => console.error("[access-log]", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Contexto da requisição atual (cabeçalhos definidos no middleware). */
export async function requestContext() {
  const h = await headers();
  const start = Number(h.get("x-request-start") ?? 0);
  return {
    path: h.get("x-pathname") ?? "",
    isAction: Boolean(h.get("next-action")),
    ip: h.get("x-client-ip") || null,
    userAgent: h.get("user-agent"),
    start,
    elapsed: () => (start ? Date.now() - start : null),
  };
}

/**
 * Registra o acesso (página ou ação) do usuário atual. Chamado por requireUser(),
 * portanto roda uma vez por requisição autenticada.
 */
export async function logRequest(userId: string | null) {
  const ctx = await requestContext();
  if (!ctx.path || ctx.path.startsWith("/api/auth")) return;
  writeAccessLog({
    userId,
    kind: ctx.isAction ? "ACTION" : "PAGE",
    path: ctx.path,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    durationMs: ctx.elapsed(),
  });
}

/** Mede e registra uma função nomeada (ex.: geração de ata pelo Claude). */
export async function timed<T>(name: string, userId: string | null, fn: () => Promise<T>): Promise<T> {
  const ctx = await requestContext();
  const t0 = Date.now();
  try {
    const result = await fn();
    writeAccessLog({ userId, kind: "ACTION", path: ctx.path, name, durationMs: Date.now() - t0, ip: ctx.ip, userAgent: ctx.userAgent });
    return result;
  } catch (e) {
    writeAccessLog({ userId, kind: "ERROR", path: ctx.path, name, status: 500, durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e), ip: ctx.ip });
    throw e;
  }
}
