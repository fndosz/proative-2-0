import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentScope, getCurrentUser } from "@/lib/authz";
import { readFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Download sempre pelo servidor: permissão checada aqui, URL do Blob nunca chega ao navegador. */
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });
  const { versionId } = await params;
  const version = await db.documentVersion.findFirst({
    where: { id: versionId, document: documentScope(user) },
    include: { document: true },
  });
  if (!version) return new NextResponse("Não encontrado", { status: 404 });
  const stream = await readFile(version.blobPathname);
  if (!stream) return new NextResponse("Arquivo indisponível", { status: 404 });
  await audit({ actorId: user.id, action: "document.download", entityType: "Document", entityId: version.documentId, summary: `Baixou "${version.document.title}" (v${version.number})` });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": version.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(version.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
