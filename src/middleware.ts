import { NextResponse, type NextRequest } from "next/server";

// Marca cada requisição com caminho e horário de início; o log de acesso
// (src/lib/access-log.ts) lê esses cabeçalhos no servidor.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  headers.set("x-request-start", String(Date.now()));
  headers.set("x-client-ip", req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)"],
};
