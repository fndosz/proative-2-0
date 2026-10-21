// Estrutura inicial: só as diretorias (sem dados inventados) e o(s) convite(s) de admin.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DIRETORIAS = [
  ["vendas", "Vendas"],
  ["parcerias", "Parcerias"],
  ["rh", "RH"],
  ["governanca", "Governança"],
  ["financeiro", "Financeiro"],
] as const;

async function main() {
  for (const [i, [slug, name]] of DIRETORIAS.entries()) {
    await db.directorate.upsert({ where: { slug }, create: { slug, name, sortOrder: i }, update: { name, sortOrder: i } });
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
