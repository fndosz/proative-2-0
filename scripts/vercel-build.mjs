// Build na Vercel: resolve a URL do banco (nomes variam conforme a integração),
// aplica migrações, roda o seed e compila.
import { execSync } from "node:child_process";

const candidates = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];
const found = candidates.find((k) => process.env[k]);
const related = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|PG|NEON|BLOB|AUTH_/i.test(k)).sort();
console.log("Variáveis relacionadas presentes (só nomes):", related.join(", ") || "nenhuma");

if (!found) {
  console.error("Nenhuma URL de banco encontrada. Conecte o Neon ao projeto (Storage → Connect Project) ou defina DATABASE_URL.");
  process.exit(1);
}
process.env.DATABASE_URL = process.env[found];
console.log(`Usando ${found} como DATABASE_URL`);

for (const cmd of ["prisma generate", "prisma migrate deploy", "tsx prisma/seed.ts", "next build"]) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}
