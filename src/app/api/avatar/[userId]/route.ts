import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/authz";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

/** Foto de perfil: só para usuários logados; o arquivo fica no armazenamento privado. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse(null, { status: 401 });
  const { userId } = await params;
  const u = await db.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!u?.image) return new NextResponse(null, { status: 404 });
  if (u.image.startsWith("http")) return NextResponse.redirect(u.image);
  const stream = await readFile(u.image);
  if (!stream) return new NextResponse(null, { status: 404 });
  const ext = u.image.split(".").pop()?.toLowerCase();
  const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(stream, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
}
