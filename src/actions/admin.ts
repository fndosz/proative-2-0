"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { ROLE_LABEL } from "@/lib/format";

const roleEnum = z.enum(["ADMIN", "DIRETORIA", "CONSULTOR", "LEITOR"]);

export async function inviteUser(fd: FormData) {
  const admin = await requireRole("ADMIN");
  const email = z.string().email("E-mail inválido").parse(String(fd.get("email") ?? "").trim().toLowerCase());
  const role = roleEnum.parse(fd.get("role"));
  const directorateIds = fd.getAll("directorateIds").map(String);
  if (await db.user.findUnique({ where: { email } })) throw new Error("Esse e-mail já é usuário.");
  await db.invite.upsert({
    where: { email },
    create: { email, role, directorateIds, invitedById: admin.id },
    update: { role, directorateIds, invitedById: admin.id },
  });
  await audit({ actorId: admin.id, action: "user.invite", entityType: "Invite", entityId: email, summary: `Convidou ${email} como ${ROLE_LABEL[role]}` });
  revalidatePath("/admin");
}

export async function revokeInvite(inviteId: string) {
  const admin = await requireRole("ADMIN");
  const inv = await db.invite.delete({ where: { id: inviteId, acceptedAt: null } });
  await audit({ actorId: admin.id, action: "user.revokeInvite", entityType: "Invite", entityId: inv.email, summary: `Cancelou o convite de ${inv.email}` });
  revalidatePath("/admin");
}

export async function updateUser(userId: string, fd: FormData) {
  const admin = await requireRole("ADMIN");
  const role = roleEnum.parse(fd.get("role"));
  const active = fd.get("active") === "on";
  if (userId === admin.id && (role !== "ADMIN" || !active)) throw new Error("Você não pode remover seu próprio acesso de administrador.");
  const directorates = await db.directorate.findMany({ select: { id: true } });
  const memberships = directorates
    .map((d) => ({ directorateId: d.id, access: String(fd.get(`dir_${d.id}`) ?? "") }))
    .filter((m) => m.access === "LEITURA" || m.access === "EDICAO") as { directorateId: string; access: "LEITURA" | "EDICAO" }[];
  const user = await db.user.update({
    where: { id: userId },
    data: {
      role,
      active,
      directorates: { deleteMany: {}, create: memberships },
    },
  });
  await audit({
    actorId: admin.id,
    action: "user.update",
    entityType: "User",
    entityId: userId,
    summary: `Atualizou ${user.name ?? user.email}: ${ROLE_LABEL[role]}, ${active ? "ativo" : "desativado"}, ${memberships.length} diretoria(s)`,
  });
  revalidatePath("/admin");
}
