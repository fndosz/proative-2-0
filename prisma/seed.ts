// Estrutura inicial: só as diretorias (sem dados inventados) e o(s) convite(s) de admin.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Nomes podem ser alterados depois em Administração → Diretorias; o seed só garante que existam.
const DIRETORIAS = [
  ["vendas", "Vendas / Marketing"],
  ["parceria-produto", "Parceria / Produto"],
  ["rh", "RH"],
  ["governanca", "Governança"],
  ["financeiro", "Financeiro"],
] as const;

async function main() {
  // Renomeações pontuais definidas pelo cliente (aplicadas uma vez; depois o admin edita pelo portal)
  const RENAMES: Record<string, [string, string]> = { vendas: ["Vendas", "Vendas / Marketing"] };
  for (const [i, [slug, name]] of DIRETORIAS.entries()) {
    const existing = await db.directorate.findUnique({ where: { slug } });
    if (!existing) {
      await db.directorate.create({ data: { slug, name, sortOrder: i } });
    } else if (RENAMES[slug] && existing.name === RENAMES[slug][0]) {
      await db.directorate.update({ where: { slug }, data: { name: RENAMES[slug][1] } });
    }
  }
  // Unificação pedida em 23/10/2026: "Parcerias" → "Parceria / Produto" (membros e registros migram; a antiga é removida)
  const old = await db.directorate.findUnique({ where: { slug: "parcerias" } });
  const target = await db.directorate.findUnique({ where: { slug: "parceria-produto" } });
  if (old && target) {
    const members = await db.directorateMember.findMany({ where: { directorateId: old.id } });
    for (const m of members) {
      await db.directorateMember.upsert({
        where: { userId_directorateId: { userId: m.userId, directorateId: target.id } },
        create: { userId: m.userId, directorateId: target.id, access: m.access },
        update: { access: m.access === "EDICAO" ? "EDICAO" : undefined },
      });
    }
    const moved = await db.$transaction([
      db.meeting.updateMany({ where: { directorateId: old.id }, data: { directorateId: target.id } }),
      db.actionItem.updateMany({ where: { directorateId: old.id }, data: { directorateId: target.id } }),
      db.document.updateMany({ where: { directorateId: old.id }, data: { directorateId: target.id } }),
      db.note.updateMany({ where: { directorateId: old.id }, data: { directorateId: target.id } }),
      db.goal.updateMany({ where: { directorateId: old.id }, data: { directorateId: target.id } }),
      db.directorate.update({ where: { id: target.id }, data: { sortOrder: old.sortOrder } }),
      db.directorate.delete({ where: { id: old.id } }),
    ]);
    await db.auditEvent.create({
      data: {
        action: "directorate.merge",
        entityType: "Directorate",
        entityId: target.id,
        summary: `Unificou "Parcerias" em "Parceria / Produto" (${members.length} membro(s), ${moved[0].count} reuniões, ${moved[1].count} ações, ${moved[2].count} documentos, ${moved[3].count} anotações)`,
      },
    });
    console.log(`Unificação: ${members.length} membro(s) migrados; Parcerias removida.`);
  }
  const all = await db.directorate.findMany();
  const admins = (process.env.INITIAL_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of admins) {
    await db.invite.upsert({
      where: { email },
      create: { email, role: "ADMIN", directorateIds: all.map((d) => d.id) },
      update: { role: "ADMIN" },
    });
  }
  console.log(`Diretorias: ${all.length}. Convites de admin: ${admins.join(", ") || "nenhum (defina INITIAL_ADMIN_EMAILS)"}`);
}

main().finally(() => db.$disconnect());
