import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

// Redação da ata a partir de transcrição/rascunho, no modelo Proative.
// A chave fica no servidor (ANTHROPIC_API_KEY); nunca chega ao navegador.

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
// US$ por milhão de tokens (Claude Opus 5.5)
const PRICE = { input: 4, output: 20 };

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const AtaSchema = z.object({
  agenda: z.string().describe("Ordem do dia: itens de pauta, um por linha, numerados."),
  discussions: z.string().describe("Deliberações: resumo formal do que foi discutido em cada item da pauta, em parágrafos."),
  generalTopics: z.string().describe("Assuntos gerais tratados fora da pauta. Vazio se não houver."),
  decisions: z.array(
    z.object({
      text: z.string(),
      status: z.enum(["DECIDIDA", "PENDENTE"]).describe("PENDENTE quando a decisão ficou em aberto ou dependente de confirmação."),
    }),
  ),
  referrals: z.array(
    z.object({
      text: z.string().describe("O que deve ser feito."),
      ownerName: z.string().nullable().describe("Responsável, exatamente como nomeado na transcrição; null se não houver."),
      dueDate: z.string().nullable().describe("Prazo no formato AAAA-MM-DD, apenas se explícito ou inequívoco; senão null."),
    }),
  ),
  closing: z.string().describe("Encerramento: horário e observações finais, se constarem."),
  participantsDetected: z.array(z.string()).describe("Nomes de pessoas que falaram ou foram citadas como presentes e ainda não estão na lista de participantes."),
  unclear: z.array(z.string()).describe("Pontos ambíguos ou sem clareza na transcrição que precisam de confirmação."),
});
export type AtaDraft = z.infer<typeof AtaSchema>;

const SYSTEM = `Você é o(a) secretário(a) executivo(a) da Proative e redige atas no modelo oficial da empresa.

Regras invioláveis:
- Use SOMENTE o que está na transcrição/rascunho. Não invente nomes, números, datas, decisões ou encaminhamentos.
- Quando algo estiver ambíguo, incompleto ou inaudível, escreva o trecho seguido de "[a confirmar]" e liste o ponto em "unclear".
- Linguagem formal, impessoal, em português do Brasil, tempo passado ("foi apresentado", "deliberou-se"). Remova vícios de fala, repetições e conversas paralelas.
- Agrupe por tema seguindo a pauta. Não repita em "generalTopics" o que já está em "discussions".
- Decisões são conclusões efetivas; encaminhamentos são tarefas com responsável e prazo. Não transforme uma coisa na outra.
- Prazos só quando explícitos; converta expressões como "até sexta" para data apenas se a data da reunião permitir calcular com segurança.
- Nomes de participantes: use exatamente como aparecem; se um falante for identificado só por rótulo (ex.: "Falante 2"), mantenha o rótulo seguido de "[a confirmar]".`;

export type AtaContext = {
  title: string;
  type: string;
  date: Date;
  location: string | null;
  directorate: string | null;
  participants: { name: string; role: string | null }[];
  transcript: string;
};

export type AtaResult = {
  draft: AtaDraft;
  usage: { input: number; output: number; cacheRead: number };
  costCents: number;
  model: string;
  stopReason: string | null;
};

export async function generateAta(ctx: AtaContext): Promise<AtaResult> {
  if (!aiEnabled()) throw new Error("A chave da API do Claude (ANTHROPIC_API_KEY) não está configurada no servidor.");
  const client = new Anthropic();

  const dateStr = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(ctx.date);
  const header = [
    `Reunião: ${ctx.title}`,
    `Tipo: ${ctx.type}`,
    `Data: ${dateStr}`,
    ctx.location ? `Local: ${ctx.location}` : null,
    ctx.directorate ? `Diretoria: ${ctx.directorate}` : null,
    `Participantes já cadastrados: ${ctx.participants.length ? ctx.participants.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join("; ") : "nenhum"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "high", format: zodOutputFormat(AtaSchema) },
    messages: [
      {
        role: "user",
        content: `${header}\n\n=== TRANSCRIÇÃO / RASCUNHO ===\n${ctx.transcript.trim()}\n=== FIM ===\n\nRedija a ata desta reunião no modelo Proative.`,
      },
    ],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new Error("O Claude não pôde redigir esta ata (conteúdo recusado pelos filtros de segurança).");
  if (msg.stop_reason === "max_tokens") throw new Error("A transcrição é longa demais para uma única geração. Divida-a em partes.");

  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const draft = AtaSchema.parse(JSON.parse(text));

  const input = msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0);
  const cacheRead = msg.usage.cache_read_input_tokens ?? 0;
  const output = msg.usage.output_tokens;
  const costCents = Math.round(((input * PRICE.input + cacheRead * PRICE.input * 0.1 + output * PRICE.output) / 1_000_000) * 100);

  return { draft, usage: { input, output, cacheRead }, costCents, model: msg.model, stopReason: msg.stop_reason };
}

// ───────────── Assistente da ata: conversa + alterações estruturadas ─────────────

const Field = z.enum(["agenda", "discussions", "generalTopics", "closing"]);

export const OperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_field"), field: Field, value: z.string() }).describe("Substitui o texto inteiro de uma seção da ata."),
  z.object({ type: z.literal("rename_participant"), from: z.string(), to: z.string() }).describe("Troca o nome de um participante em todos os lugares da ata."),
  z.object({ type: z.literal("set_participant_role"), name: z.string(), role: z.string() }),
  z.object({ type: z.literal("add_participant"), name: z.string(), role: z.string().nullable() }),
  z.object({ type: z.literal("add_decision"), text: z.string(), status: z.enum(["DECIDIDA", "PENDENTE"]) }),
  z.object({ type: z.literal("update_decision"), id: z.string(), text: z.string().nullable(), status: z.enum(["DECIDIDA", "PENDENTE"]).nullable() }),
  z.object({ type: z.literal("delete_decision"), id: z.string() }),
  z.object({ type: z.literal("add_referral"), text: z.string(), ownerName: z.string().nullable(), dueDate: z.string().nullable().describe("AAAA-MM-DD ou null") }),
  z.object({ type: z.literal("update_referral"), id: z.string(), text: z.string().nullable(), ownerName: z.string().nullable(), dueDate: z.string().nullable() }),
  z.object({ type: z.literal("delete_referral"), id: z.string() }),
]);
export type Operation = z.infer<typeof OperationSchema>;

export const ChatReplySchema = z.object({
  reply: z.string().describe("Resposta ao usuário em português, curta e direta. Resumos e destaques pedidos vêm aqui, em texto corrido ou lista."),
  operations: z.array(OperationSchema).describe("Alterações a aplicar na ata. Vazio quando o pedido é só uma pergunta, resumo ou análise."),
});
export type ChatReply = z.infer<typeof ChatReplySchema>;

const CHAT_SYSTEM = `Você é o assistente da ata no portal Proative 2.0. Você conversa com quem está editando a ata e, quando pedido, altera a ata por meio de "operations".

Regras:
- Responda em português do Brasil, formal mas direto. Não repita a ata inteira na resposta; descreva o que fez.
- Só altere o que foi pedido. Pedidos de resumo, destaque, revisão ou dúvida NÃO geram operations — a resposta vai só em "reply".
- Nunca invente fatos: use o que está na ata, na transcrição e nos participantes. Se faltar informação, pergunte ou marque "[a confirmar]".
- Para renomear pessoas use rename_participant (uma por nome). Para mudar o papel use set_participant_role.
- Para "formalizar", "resumir uma seção", "reescrever": use set_field com o texto completo novo da seção.
- Decisões e encaminhamentos têm ids; use update_/delete_ com o id exato listado. Datas de prazo no formato AAAA-MM-DD.
- Se o pedido for ambíguo, não aplique nada: explique as opções em "reply".`;

export type ChatContext = AtaContext & {
  minutes: { agenda: string; discussions: string; generalTopics: string; closing: string };
  decisions: { id: string; text: string; status: string }[];
  referrals: { id: string; text: string; ownerName: string | null; dueDate: string | null }[];
  history: { role: "user" | "assistant"; content: string }[];
  prompt: string;
};

export async function chatAta(ctx: ChatContext): Promise<ChatReply & { usage: AtaResult["usage"]; costCents: number; model: string }> {
  if (!aiEnabled()) throw new Error("A chave da API do Claude (ANTHROPIC_API_KEY) não está configurada no servidor.");
  const client = new Anthropic();
  const dateStr = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(ctx.date);
  const state = [
    `Reunião: ${ctx.title} · ${ctx.type} · ${dateStr}${ctx.directorate ? ` · ${ctx.directorate}` : ""}`,
    `Participantes: ${ctx.participants.length ? ctx.participants.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join("; ") : "nenhum"}`,
    `\n## Ordem do dia\n${ctx.minutes.agenda || "(vazio)"}`,
    `\n## Deliberações\n${ctx.minutes.discussions || "(vazio)"}`,
    `\n## Assuntos gerais\n${ctx.minutes.generalTopics || "(vazio)"}`,
    `\n## Encerramento\n${ctx.minutes.closing || "(vazio)"}`,
    `\n## Decisões\n${ctx.decisions.length ? ctx.decisions.map((d) => `- [id ${d.id}] (${d.status}) ${d.text}`).join("\n") : "(nenhuma)"}`,
    `\n## Encaminhamentos\n${ctx.referrals.length ? ctx.referrals.map((r) => `- [id ${r.id}] ${r.text} — resp.: ${r.ownerName ?? "—"}; prazo: ${r.dueDate ?? "—"}`).join("\n") : "(nenhum)"}`,
    ctx.transcript.trim() ? `\n## Transcrição / rascunho (referência)\n${ctx.transcript.trim().slice(0, 60000)}` : "",
  ].join("\n");

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: CHAT_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(ChatReplySchema) },
    messages: [
      { role: "user", content: `=== ESTADO ATUAL DA ATA ===\n${state}\n=== FIM ===` },
      { role: "assistant", content: '{"reply":"Entendido. Estou com a ata carregada; o que você precisa?","operations":[]}' },
      ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: ctx.prompt },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("O Claude não pôde atender este pedido (filtros de segurança).");
  if (msg.stop_reason === "max_tokens") throw new Error("Resposta longa demais; peça algo mais específico.");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = ChatReplySchema.parse(JSON.parse(text));
  const input = msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0);
  const cacheRead = msg.usage.cache_read_input_tokens ?? 0;
  const output = msg.usage.output_tokens;
  const costCents = Math.round(((input * PRICE.input + cacheRead * PRICE.input * 0.1 + output * PRICE.output) / 1_000_000) * 100);
  return { ...parsed, usage: { input, output, cacheRead }, costCents, model: msg.model };
}
