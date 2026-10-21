"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canEdit, requireUser } from "@/lib/authz";
import { parseDate } from "@/lib/format";

export async function addGoal(directorateId: string, fd: FormData) {
  const user = await requireUser();
  if (!canEdit(user, directorateId)) notFound();
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const goal = await db.goal.create({
    data: { directorateId, title, description: String(fd.get("description") ?? "").trim() || null, dueDate: parseDate(fd.get("dueDate")) },
    include: { directorate: true },
  });
  await audit({ actorId: user.id, action: "goal.create", entityType: "Directorate", entityId: directorateId, summary: `Adicionou a meta "${title}" em ${goal.directorate.name}` });
  revalidatePath(`/diretorias/${goal.directorate.slug}`);
}

export async function deleteGoal(goalId: string) {
  const user = await requireUser();
  const goal = await db.goal.findUnique({ where: { id: goalId }, include: { directorate: true } });
  if (!goal || !canEdit(user, goal.directorateId)) notFound();
  await db.goal.delete({ where: { id: goalId } });
  await audit({ actorId: user.id, action: "goal.delete", entityType: "Directorate", entityId: goal.directorateId, summary: `Removeu a meta "${goal.title}"` });
  revalidatePath(`/diretorias/${goal.directorate.slug}`);
}
