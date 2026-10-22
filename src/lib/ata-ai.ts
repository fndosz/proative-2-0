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
