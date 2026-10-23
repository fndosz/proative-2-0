import type { Instrumentation } from "next";

// Erros não tratados do servidor (páginas, ações e rotas) vão para o log de acesso.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { db } = await import("./lib/db");
    const e = err as { message?: string; digest?: string };
    await db.accessLog.create({
      data: {
        kind: "ERROR",
        path: request.path.split("?")[0],
        name: `${context.routeType}:${context.routerKind}`,
        status: 500,
        error: `${e.message ?? String(err)}${e.digest ? ` (digest ${e.digest})` : ""}`.slice(0, 500),
        userAgent: request.headers["user-agent"]?.toString().slice(0, 300) ?? null,
      },
    });
  } catch (logErr) {
    console.error("[instrumentation] falha ao registrar erro", logErr);
  }
};
