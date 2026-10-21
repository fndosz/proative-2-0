# Proative 2.0 — portal de governança

Next.js 15 (App Router, TypeScript) · PostgreSQL via Prisma · Auth.js com Microsoft 365 (Entra ID) · Vercel Blob privado · PDF das atas gerado no servidor.

## O que a v1 tem

| Módulo | Rota | Situação |
|---|---|---|
| Login Microsoft 365 + convite | `/login`, `/admin` | pronto — só entra e-mail convidado ou admin inicial |
| Painel geral | `/` | pronto |
| Reuniões e atas | `/reunioes` | pronto — ata no modelo Proative, decisões, encaminhamentos → ações, aprovação com versão congelada, PDF |
| Plano de ação | `/acoes` | pronto — lista e Kanban, filtros, comentários, anexos, histórico, origem |
| Biblioteca | `/biblioteca` | pronto — versões, etiquetas, vínculos, busca, documento restrito por pessoa |
| Diretorias | `/diretorias` | pronto — metas, ações, documentos, reuniões, membros (indicadores: fase 2) |
| Histórico | `/historico` | pronto — tabela de auditoria |
| Gravações Plaud | dentro da reunião | **etapa 1**: upload do áudio bruto. Transcrição e redação pelo Claude aguardam decisões |
| Conselho consultivo, Consultoria | `/conselho`, `/consultoria` | fase 2 (placeholder) |

Permissões: perfil (Admin / Diretoria / Consultor / Leitor) + acesso por diretoria (leitura/edição) + ACL por documento. Tudo checado no servidor, inclusive o download de arquivos (`/api/arquivos/[id]`).

## Rodar localmente

```bash
cp .env.example .env   # preencher DATABASE_URL etc.
npm install
npx prisma migrate deploy
npm run db:seed        # cria as 5 diretorias e o convite do admin inicial
npm run dev
```

Sem `BLOB_READ_WRITE_TOKEN`, os arquivos vão para `.storage/` no disco. Com `DEV_LOGIN=1` (só fora de produção) aparece um login de teste para usuários já existentes no banco.

## Publicar na Vercel

1. Criar o projeto ligado ao repositório GitHub.
2. Adicionar Neon (Postgres) e um Blob store **privado** pelo Marketplace da Vercel — as variáveis `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `BLOB_READ_WRITE_TOKEN` entram sozinhas.
3. Registrar o app no Entra ID da Proative (single tenant), redirect URI `https://<domínio>/api/auth/callback/microsoft-entra-id`, e preencher `AUTH_MICROSOFT_ENTRA_ID_*` e `AUTH_SECRET`.
4. `INITIAL_ADMIN_EMAILS` com o(s) admin(s) inicial(is).
5. Rodar `npx prisma migrate deploy` e `npm run db:seed` contra o banco de produção.

## Pendências conhecidas

- **Uploads grandes**: na Vercel o corpo de uma requisição é limitado a ~4,5 MB. Áudios do Plaud e documentos maiores precisam de upload direto do navegador ao Blob (`@vercel/blob/client`) — próximo passo.
- **Transcrição + Claude**: escolher o serviço de speech-to-text (AssemblyAI / Deepgram / Azure) e definir a chave da API do Claude.
- **Identidade visual**: cores em `src/app/globals.css` (`--brand`, `--brand-accent`); falta o manual de marca.
