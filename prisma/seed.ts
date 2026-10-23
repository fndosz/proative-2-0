// Estrutura inicial: só as diretorias (sem dados inventados) e o(s) convite(s) de admin.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Nomes podem ser alterados depois em Administração → Diretorias; o seed só garante que existam.
const DIRETORIAS = [
  ["vendas", "Vendas / Marketing"],
  ["parcerias", "Parcerias"],
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
