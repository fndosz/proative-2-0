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
| Indicadores e logs | `/admin`, `/admin/logs` | pronto — requisições, tempo médio/P95, erros, rotas lentas, uso da IA; log de acessos (90 dias) e auditoria |
| Rascunho / transcrição → ata | dentro da reunião | pronto — texto livre guardado no histórico, importação de Word (.docx); **Gerar ata com IA** redige no modelo Proative (Claude Opus 5.5, `ANTHROPIC_API_KEY`) |
| Gravações Plaud | dentro da reunião | **etapa 1**: upload do áudio bruto; speech-to-text ainda não ligado |
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
3. App no Entra ID da Proative: **Proative 2.0 - Portal** (single tenant, client ID `8c484b4a-4e74-4f5a-b027-99a2197e27e6`), redirect URI `https://proative-2-0.vercel.app/api/auth/callback/microsoft-entra-id`. Segredo "Vercel producao" expira em **20/10/2028** — gerar outro em Certificados e segredos e atualizar `AUTH_MICROSOFT_ENTRA_ID_SECRET` antes disso. Ao trocar de domínio, adicionar o novo redirect URI no app.
4. `INITIAL_ADMIN_EMAILS` com o(s) admin(s) inicial(is).
5. Rodar `npx prisma migrate deploy` e `npm run db:seed` contra o banco de produção.

## Operação

- **Logs**: `AccessLog` registra páginas, ações, logins e erros do servidor (middleware + `requireUser` + `instrumentation.ts`); `AuditEvent` registra o que cada usuário fez. Cron diário (`/api/cron/limpeza`, `vercel.json`) apaga acessos com mais de `LOG_RETENTION_DAYS` (90) dias e áudios fora do prazo; defina `CRON_SECRET` na Vercel para proteger a rota.
- **Performance**: funções rodam em `gru1` (mesma região do Neon e do Blob), índices nas consultas principais, `loading.tsx` com esqueleto, Speed Insights e Analytics da Vercel ligados.

## Pendências conhecidas

- **Uploads grandes**: na Vercel o corpo de uma requisição é limitado a ~4,5 MB. Áudios do Plaud e documentos maiores precisam de upload direto do navegador ao Blob (`@vercel/blob/client`) — próximo passo.
- **Transcrição automática**: escolher o serviço de speech-to-text (AssemblyAI / Deepgram / Azure) para transformar o áudio do Plaud em texto; hoje a transcrição é colada manualmente.
- **Chave do Claude**: `ANTHROPIC_API_KEY` na Vercel (Production). Sem ela o botão "Gerar ata com IA" fica desligado; o rascunho continua salvando. Custo por geração fica registrado na ata e no Histórico.
- **Identidade visual**: tokens do brandbook Proative 2.0 em `src/app/globals.css` (`@theme`: `accent`, `ink`, `line`, `surface`…), fontes Source Sans 3 (títulos) e Open Sans (texto), logotipo em `src/components/logo.tsx`.
