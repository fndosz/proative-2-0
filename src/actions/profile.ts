"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/authz";
import { deleteFile, saveFile } from "@/lib/storage";

export type ProfileState = { ok?: string; error?: string } | null;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function updateProfile(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe seu nome." };
  const data: { name: string; image?: string | null } = { name };

  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!IMAGE_TYPES.includes(photo.type)) return { error: "Use uma imagem JPG, PNG ou WebP." };
    if (photo.size > 3 * 1024 * 1024) return { error: "Foto acima de 3 MB." };
    data.image = await saveFile(`avatares/${user.id}`, photo);
    if (user.image && !user.image.startsWith("http")) await deleteFile(user.image).catch(() => null);
  } else if (fd.get("removePhoto") === "on") {
    if (user.image && !user.image.startsWith("http")) await deleteFile(user.image).catch(() => null);
    data.image = null;
  }

  await db.user.update({ where: { id: user.id }, data });
  await audit({ actorId: user.id, action: "user.profile", entityType: "User", entityId: user.id, summary: `Atualizou o próprio perfil${data.image !== undefined ? " (foto)" : ""}` });
  revalidatePath("/", "layout");
  return { ok: "Perfil atualizado." };
}

export async function setTheme(theme: string) {
  const value = theme === "dark" || theme === "light" ? theme : "system";
  (await cookies()).set("theme", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
