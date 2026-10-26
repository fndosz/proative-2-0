"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { signIn } from "@/auth";
import { ROLE_LABEL } from "@/lib/format";
import { buildInviteEmail, MAIL_CC, sendMail } from "@/lib/mail";

const roleEnum = z.enum(["ADMIN", "DIRETORIA", "CONSULTOR", "LEITOR"]);

export type InviteState = { ok?: string; error?: string } | null;

export async function inviteUser(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const admin = await requireRole("ADMIN");
  const parsed = z.string().email().safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const email = parsed.data;
  const role = roleEnum.parse(fd.get("role"));
  const directorateIds = fd.getAll("directorateIds").map(String);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: existing.active ? `${email} já é usuário do portal — ajuste o perfil dele na lista abaixo.` : `${email} já existe, mas está desativado — reative-o na lista abaixo.` };
  }
  const previous = await db.invite.findUnique({ where: { email } });
  const invite = await db.invite.upsert({
    where: { email },
    create: { email, role, directorateIds, invitedById: admin.id },
    update: { role, directorateIds, invitedById: admin.id, acceptedAt: null },
  });
  await audit({ actorId: admin.id, action: "user.invite", entityType: "Invite", entityId: email, summary: `${previous ? "Atualizou o convite de" : "Convidou"} ${email} como ${ROLE_LABEL[role]}` });
  const mail = await deliverInvite(invite.id, admin.id);
  revalidatePath("/admin");
  const base = `${previous ? "Convite atualizado" : "Convite criado"} para ${email}.`;
  return mail.sent
    ? { ok: `${base} E-mail de acesso enviado (cópia para ${MAIL_CC.join(", ")}).` }
    : { ok: `${base} O e-mail NÃO foi enviado automaticamente (${mail.reason}). Use "Abrir no Outlook" na lista de convites.` };
}

/** Monta e envia o e-mail de convite; registra o resultado no convite e na auditoria. */
async function deliverInvite(inviteId: string, senderId: string) {
  const inv = await db.invite.findUniqueOrThrow({ where: { id: inviteId }, include: { invitedBy: true } });
  const dirs = await db.directorate.findMany({ where: { id: { in: inv.directorateIds } }, select: { name: true } });
  const mail = buildInviteEmail({ email: inv.email, role: inv.role, directorates: dirs.map((d) => d.name), invitedBy: inv.invitedBy?.name ?? inv.invitedBy?.email ?? "Proative" });
  const r = await sendMail(mail, senderId);
  await db.invite.update({ where: { id: inviteId }, data: r.sent ? { emailSentAt: new Date(), emailError: null } : { emailError: r.reason.slice(0, 300) } });
  await audit({ actorId: senderId, action: r.sent ? "user.inviteMail" : "user.inviteMailFailed", entityType: "Invite", entityId: inv.email, summary: r.sent ? `E-mail de convite enviado a ${inv.email} (cc ${MAIL_CC.join(", ")})` : `Falha ao enviar e-mail de convite a ${inv.email}: ${r.reason.slice(0, 120)}` });
  return r;
}

export async function resendInvite(inviteId: string) {
  const admin = await requireRole("ADMIN");
  await deliverInvite(inviteId, admin.id);
  revalidatePath("/admin");
}

export async function revokeInvite(inviteId: string) {
  const admin = await requireRole("ADMIN");
  const inv = await db.invite.findUnique({ where: { id: inviteId } });
  // tolerante: um clique repetido ou um convite já aceito não derruba a página
  const r = await db.invite.deleteMany({ where: { id: inviteId, acceptedAt: null } });
  if (inv && r.count > 0) {
    await audit({ actorId: admin.id, action: "user.revokeInvite", entityType: "Invite", entityId: inv.email, summary: `Cancelou o convite de ${inv.email}` });
  }
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


/** Pede à Microsoft a permissão Mail.Send para a conta do administrador logado (envio de convites pela caixa dele). */
export async function connectMailbox() {
  await requireRole("ADMIN");
  await signIn("microsoft-entra-id", { redirectTo: "/admin" }, { scope: "openid profile email offline_access User.Read Mail.Send", prompt: "consent" });
}
