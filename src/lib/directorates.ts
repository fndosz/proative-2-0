import "server-only";
import { db } from "./db";
import { canEdit, visibleDirectorateIds, type CurrentUser } from "./authz";

export async function directoratesFor(user: CurrentUser, mode: "view" | "edit" = "view") {
  const ids = visibleDirectorateIds(user);
  const all = await db.directorate.findMany({ where: ids === null ? {} : { id: { in: ids } }, orderBy: { sortOrder: "asc" } });
  return mode === "edit" ? all.filter((d) => canEdit(user, d.id)) : all;
}

export async function activeUsers() {
  return db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });
}
