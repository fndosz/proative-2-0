import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import type { Prisma, Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "./db";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

async function loadUser(id: string) {
  return db.user.findUnique({
    where: { id },
    include: { directorates: true },
  });
}

/** Usuário logado, relido do banco a cada request (perfil/desativação valem na hora). */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await loadUser(session.user.id);
  return user?.active ? user : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) notFound();
  return user;
}

export const isAdmin = (u: CurrentUser) => u.role === "ADMIN";

/** Diretorias visíveis; null = todas (admin). */
export function visibleDirectorateIds(u: CurrentUser): string[] | null {
  if (isAdmin(u)) return null;
  return u.directorates.map((d) => d.directorateId);
}

/** Filtro Prisma para registros com directorateId (null = "Geral", visível a todos). */
export function directorateScope(u: CurrentUser) {
  const ids = visibleDirectorateIds(u);
  if (ids === null) return {};
  return { OR: [{ directorateId: null }, { directorateId: { in: ids } }] };
}

export function canView(u: CurrentUser, directorateId: string | null) {
  if (isAdmin(u) || directorateId === null) return true;
  return u.directorates.some((d) => d.directorateId === directorateId);
}

export function canEdit(u: CurrentUser, directorateId: string | null) {
  if (isAdmin(u)) return true;
  if (u.role === "LEITOR") return false;
  if (directorateId === null) return u.role === "DIRETORIA";
  return u.directorates.some((d) => d.directorateId === directorateId && d.access === "EDICAO");
}

/** Pode aprovar ata: admin ou diretoria responsável com edição. */
export function canApproveMinutes(u: CurrentUser, directorateId: string | null) {
  if (isAdmin(u)) return true;
  return u.role === "DIRETORIA" && canEdit(u, directorateId);
}

/** Filtro de documentos: diretoria + ACL por documento. */
export function documentScope(u: CurrentUser): Prisma.DocumentWhereInput {
  if (isAdmin(u)) return {};
  return {
    AND: [
      directorateScope(u),
      { OR: [{ restricted: false }, { access: { some: { userId: u.id } } }, { createdById: u.id }] },
    ],
  };
}
