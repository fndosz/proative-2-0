import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

export type RouteStat = { path: string; requests: number; avgMs: number; p95Ms: number; errors: number };

/** Indicadores operacionais calculados do log de acesso (janela em horas). */
export async function perfMetrics(hours: number) {
  const since = new Date(Date.now() - hours * 3600_000);
  const [totals, byRoute, slowest, errorsRecent, ai, activeUsers] = await Promise.all([
    db.$queryRaw<{ requests: bigint; users: bigint; errors: bigint; avg_ms: number | null; p95_ms: number | null }[]>(Prisma.sql`
      SELECT count(*)::bigint AS requests,
             count(DISTINCT "userId")::bigint AS users,
             count(*) FILTER (WHERE kind = 'ERROR' OR status >= 500)::bigint AS errors,
             avg("durationMs") AS avg_ms,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95_ms
      FROM "AccessLog" WHERE "createdAt" >= ${since} AND kind IN ('PAGE','ACTION','ERROR')`),
    db.$queryRaw<{ path: string; requests: bigint; avg_ms: number | null; p95_ms: number | null; errors: bigint }[]>(Prisma.sql`
      SELECT regexp_replace(path, '/c[a-z0-9]{20,}', '/[id]', 'g') AS path,
             count(*)::bigint AS requests, avg("durationMs") AS avg_ms,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95_ms,
             count(*) FILTER (WHERE kind = 'ERROR' OR status >= 500)::bigint AS errors
      FROM "AccessLog" WHERE "createdAt" >= ${since} AND kind IN ('PAGE','ACTION','ERROR')
      GROUP BY 1 ORDER BY requests DESC LIMIT 12`),
    db.accessLog.findMany({ where: { createdAt: { gte: since }, durationMs: { not: null } }, orderBy: { durationMs: "desc" }, take: 5, select: { path: true, name: true, durationMs: true, createdAt: true } }),
    db.accessLog.findMany({ where: { createdAt: { gte: since }, kind: "ERROR" }, orderBy: { createdAt: "desc" }, take: 8, select: { path: true, name: true, error: true, createdAt: true } }),
    db.$queryRaw<{ runs: bigint; cost_cents: number | null; avg_ms: number | null }[]>(Prisma.sql`
      SELECT (SELECT count(*) FROM "AuditEvent" WHERE action = 'minutes.ai' AND "createdAt" >= ${since})::bigint AS runs,
             (SELECT sum((data->>'costCents')::int) FROM "AuditEvent" WHERE action = 'minutes.ai' AND "createdAt" >= ${since}) AS cost_cents,
             (SELECT avg("durationMs") FROM "AccessLog" WHERE name = 'minutes.ai' AND "createdAt" >= ${since}) AS avg_ms`),
    db.$queryRaw<{ name: string | null; email: string; requests: bigint; last: Date }[]>(Prisma.sql`
      SELECT u.name, u.email, count(*)::bigint AS requests, max(l."createdAt") AS last
      FROM "AccessLog" l JOIN "User" u ON u.id = l."userId"
      WHERE l."createdAt" >= ${since} GROUP BY u.id ORDER BY requests DESC LIMIT 8`),
  ]);
  const t = totals[0];
  const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
  const ms = (v: number | null | undefined) => (v == null ? null : Math.round(Number(v)));
  return {
    hours,
    requests: n(t?.requests),
    users: n(t?.users),
    errors: n(t?.errors),
    avgMs: ms(t?.avg_ms),
    p95Ms: ms(t?.p95_ms),
    routes: byRoute.map((r) => ({ path: r.path, requests: n(r.requests), avgMs: ms(r.avg_ms) ?? 0, p95Ms: ms(r.p95_ms) ?? 0, errors: n(r.errors) })) as RouteStat[],
    slowest,
    errorsRecent,
    ai: { runs: n(ai[0]?.runs), costCents: n(ai[0]?.cost_cents), avgMs: ms(ai[0]?.avg_ms) },
    activeUsers: activeUsers.map((u) => ({ ...u, requests: n(u.requests) })),
  };
}

/** Volumes gerais do portal (independem da janela). */
export async function portalCounts() {
  const [users, meetings, actions, documents, versions, audit, logs] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.meeting.count({ where: { archivedAt: null } }),
    db.actionItem.count({ where: { status: { not: "CONCLUIDA" } } }),
    db.document.count(),
    db.documentVersion.aggregate({ _sum: { size: true } }),
    db.auditEvent.count(),
    db.accessLog.count(),
  ]);
  return { users, meetings, actions, documents, storageBytes: versions._sum.size ?? 0, audit, logs };
}
