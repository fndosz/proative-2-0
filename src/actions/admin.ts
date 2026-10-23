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

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

export async function createDirectorate(fd: FormData) {
  const admin = await requireRole("ADMIN");
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Informe o nome da diretoria.");
  let slug = slugify(name) || "diretoria";
  if (await db.directorate.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const count = await db.directorate.count();
  const d = await db.directorate.create({ data: { name, slug, sortOrder: count, description: String(fd.get("description") ?? "").trim() || null } });
  await audit({ actorId: admin.id, action: "directorate.create", entityType: "Directorate", entityId: d.id, summary: `Criou a diretoria "${name}"` });
  revalidatePath("/", "layout");
}

export async function updateDirectorate(directorateId: string, fd: FormData) {
  const admin = await requireRole("ADMIN");
  const current = await db.directorate.findUniqueOrThrow({ where: { id: directorateId } });
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Informe o nome da diretoria.");
  const sortOrder = Number(fd.get("sortOrder") ?? current.sortOrder) || 0;
  await db.directorate.update({ where: { id: directorateId }, data: { name, sortOrder, description: String(fd.get("description") ?? "").trim() || null } });
  await audit({ actorId: admin.id, action: "directorate.update", entityType: "Directorate", entityId: directorateId, summary: current.name === name ? `Atualizou a diretoria "${name}"` : `Renomeou a diretoria "${current.name}" para "${name}"` });
  revalidatePath("/", "layout");
}

export async function deleteDirectorate(directorateId: string) {
  const admin = await requireRole("ADMIN");
  const d = await db.directorate.findUniqueOrThrow({
    where: { id: directorateId },
    include: { _count: { select: { meetings: true, actions: true, documents: true, notes: true, members: true } } },
  });
  const linked = d._count.meetings + d._count.actions + d._count.documents + d._count.notes;
  if (linked > 0) throw new Error(`"${d.name}" tem ${linked} registro(s) vinculados (reuniões, ações, documentos ou anotações). Renomeie em vez de remover.`);
  await db.directorate.delete({ where: { id: directorateId } });
  await audit({ actorId: admin.id, action: "directorate.delete", entityType: "Directorate", entityId: directorateId, summary: `Removeu a diretoria "${d.name}"` });
  revalidatePath("/", "layout");
}
