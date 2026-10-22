import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canApproveMinutes, canEdit, canView, directorateScope, requireUser } from "@/lib/authz";
import { activeUsers, directoratesFor } from "@/lib/directorates";
import {
  addDecision, addParticipant, addReferral, approveMinutes, archiveMeeting, convertReferral, deleteDecision, deleteMeeting,
  deleteReferral, removeParticipant, saveMinutes, submitMinutesForReview, toggleDecision, togglePresence, updateMeeting,
} from "@/actions/meetings";
import { ConfirmButton, SubmitButton } from "@/components/submit-button";
import { uploadRecording } from "@/actions/recordings";
import { generateAtaFromTranscript, saveTranscript } from "@/actions/ata-draft";
import { aiEnabled, MODEL } from "@/lib/ata-ai";
import { AtaDraft } from "@/components/ata-draft";

// A geração da ata pelo Claude pode levar mais de um minuto
export const maxDuration = 300;
import { ACTION_STATUS_LABEL, fmtDate, fmtDateTime, MINUTES_STATUS_LABEL, PRIORITY_LABEL, toDateInput } from "@/lib/format";
import { MeetingFields } from "@/components/meeting-form";
import { Badge, btnDanger, btnPrimary, btnSecondary, Card, Empty, Field, input, PageHeader } from "@/components/ui";

const SECTIONS = [
  { name: "agenda", label: "Ordem do dia", hint: "Itens de pauta, um por linha." },
  { name: "discussions", label: "Deliberações / discussões", hint: "O que foi discutido em cada item." },
  { name: "generalTopics", label: "Assuntos gerais", hint: "" },
  { name: "closing", label: "Encerramento", hint: "Horário de encerramento, próxima reunião etc." },
] as const;

export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const meeting = await db.meeting.findFirst({
    where: { id, ...directorateScope(user) },
    include: {
      directorate: true,
      participants: { orderBy: { name: "asc" } },
      minutes: {
        include: {
          decisions: { orderBy: { createdAt: "asc" } },
          referrals: { orderBy: { createdAt: "asc" }, include: { action: { include: { owner: true } } } },
          versions: { orderBy: { number: "desc" }, include: { approvedBy: true } },
        },
      },
      actions: { include: { owner: true }, orderBy: { createdAt: "asc" } },
      documents: { include: { document: true } },
      recordings: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!meeting || !canView(user, meeting.directorateId)) notFound();

  const editable = canEdit(user, meeting.directorateId);
  const approver = canApproveMinutes(user, meeting.directorateId);
  const minutes = meeting.minutes;
  const [directorates, users] = editable ? await Promise.all([directoratesFor(user, "edit"), activeUsers()]) : [[], []];
  const lastVersion = minutes?.versions[0];

  return (
    <>
      <PageHeader
        title={meeting.title}
        subtitle={`${meeting.type} · ${fmtDateTime(meeting.date)} · ${meeting.directorate?.name ?? "Geral"}${meeting.location ? ` · ${meeting.location}` : ""}`}
        actions={
          <>
            {minutes && <Badge className={minutes.status === "APROVADA" ? "bg-s4/12 text-s4" : "bg-warning/15 text-s6"}>Ata: {MINUTES_STATUS_LABEL[minutes.status]}</Badge>}
            <a href={`/reunioes/${meeting.id}/pdf`} className={btnSecondary} target="_blank">Exportar PDF</a>
            {editable && minutes?.status === "RASCUNHO" && (
              <form action={submitMinutesForReview.bind(null, meeting.id)}><button className={btnSecondary}>Enviar para revisão</button></form>
            )}
            {approver && minutes && minutes.status !== "APROVADA" && (
              <form action={approveMinutes.bind(null, meeting.id)}><button className={btnPrimary}>Aprovar ata</button></form>
            )}
          </>
        }
      />

      {meeting.archivedAt && (
        <p className="mb-4 rounded-lg bg-surface-2 p-3 text-sm text-ink-2">Reunião arquivada em {fmtDateTime(meeting.archivedAt)}. Ela não aparece na lista principal, mas segue no histórico.</p>
      )}
      {minutes?.status === "APROVADA" && editable && (
        <p className="mb-4 rounded-lg bg-s4/10 p-3 text-sm text-s4">
          Ata aprovada (versão {lastVersion?.number}). Qualquer edição reabre como rascunho; a versão aprovada fica guardada.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editable && (
            <Card title="Rascunho / transcrição → ata com IA">
              <AtaDraft
                transcript={minutes?.transcript ?? ""}
                updatedAt={minutes?.transcriptUpdatedAt ? fmtDateTime(minutes.transcriptUpdatedAt) : null}
                aiEnabled={aiEnabled()}
                aiInfo={minutes?.aiGeneratedAt ? `Última geração: ${fmtDateTime(minutes.aiGeneratedAt)} · ${minutes.aiModel ?? MODEL} · custo acumulado US$ ${(minutes.aiCostCents / 100).toFixed(2)}` : null}
                saveAction={saveTranscript.bind(null, meeting.id)}
                generateAction={generateAtaFromTranscript.bind(null, meeting.id)}
              />
            </Card>
          )}
          <Card title="Ata">
            {editable ? (
              <form action={saveMinutes.bind(null, meeting.id)} className="space-y-4">
                {SECTIONS.map((s) => (
                  <Field key={s.name} label={s.label} hint={s.hint}>
                    <textarea name={s.name} rows={s.name === "discussions" ? 8 : 4} defaultValue={minutes?.[s.name] ?? ""} className={input} />
                  </Field>
                ))}
                <SubmitButton className={btnPrimary}>Salvar ata</SubmitButton>
              </form>
            ) : (
              <div className="space-y-4">
                {SECTIONS.map((s) => (
                  <div key={s.name}>
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <p className="whitespace-pre-wrap text-sm text-ink">{minutes?.[s.name] || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Decisões">
            {minutes?.decisions.length ? (
              <ul className="mb-3 space-y-2">
                {minutes.decisions.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-grid p-2 text-sm">
                    <div>
                      <Badge className={d.status === "PENDENTE" ? "bg-warning/15 text-s6" : "bg-s4/12 text-s4"}>{d.status === "PENDENTE" ? "Pendente" : "Decidida"}</Badge>{" "}
                      {d.text}
                    </div>
                    {editable && (
                      <div className="flex shrink-0 gap-1">
                        <form action={toggleDecision.bind(null, meeting.id, d.id)}><button className="text-xs text-ink-3 underline">{d.status === "PENDENTE" ? "Marcar decidida" : "Marcar pendente"}</button></form>
                        <form action={deleteDecision.bind(null, meeting.id, d.id)}><button className="text-xs text-accent-ink underline">Remover</button></form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhuma decisão registrada.</Empty>
            )}
            {editable && (
              <form action={addDecision.bind(null, meeting.id)} className="mt-3 flex flex-wrap gap-2">
                <input name="text" placeholder="Nova decisão" className={`${input} flex-1`} />
                <select name="status" className={`${input} w-auto`}><option value="DECIDIDA">Decidida</option><option value="PENDENTE">Pendente</option></select>
                <button className={btnSecondary}>Adicionar</button>
              </form>
            )}
          </Card>

          <Card title="Encaminhamentos">
            {minutes?.referrals.length ? (
              <ul className="mb-3 space-y-2">
                {minutes.referrals.map((r) => (
                  <li key={r.id} className="rounded-lg border border-grid p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div>{r.text}</div>
                        <div className="text-xs text-ink-3">{r.ownerName ?? "Sem responsável"} · prazo {fmtDate(r.dueDate)}</div>
                      </div>
                      {r.action ? (
                        <Link href={`/acoes/${r.action.id}`} className="shrink-0"><Badge className="bg-s2/12 text-s2">Ação: {ACTION_STATUS_LABEL[r.action.status]}</Badge></Link>
                      ) : (
                        editable && <form action={deleteReferral.bind(null, meeting.id, r.id)}><button className="text-xs text-accent-ink underline">Remover</button></form>
                      )}
                    </div>
                    {!r.action && editable && (
                      <form action={convertReferral.bind(null, meeting.id, r.id)} className="mt-2 flex flex-wrap items-end gap-2 border-t border-dashed border-line pt-2">
                        <select name="ownerId" className={`${input} w-auto`} defaultValue="">
                          <option value="">Responsável…</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                        </select>
                        <input type="date" name="dueDate" defaultValue={toDateInput(r.dueDate)} className={`${input} w-auto`} />
                        <select name="priority" defaultValue="MEDIA" className={`${input} w-auto`}>
                          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button className={btnPrimary}>Converter em ação</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum encaminhamento registrado.</Empty>
            )}
            {editable && (
              <form action={addReferral.bind(null, meeting.id)} className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_150px_auto]">
                <input name="text" placeholder="Novo encaminhamento" className={input} />
                <input name="ownerName" placeholder="Responsável" className={input} />
                <input name="dueDate" type="date" className={input} />
                <button className={btnSecondary}>Adicionar</button>
              </form>
            )}
          </Card>

          <Card title="Gravação Plaud → ata">
            <p className="mb-3 text-sm text-ink-2">
              Envie o áudio bruto exportado do Plaud (MP3, M4A ou WAV). A transcrição com separação de falantes e o rascunho da ata
              pelo Claude serão ligados assim que o serviço de transcrição e a chave da API forem definidos.
            </p>
            {meeting.recordings.length > 0 && (
              <ul className="mb-3 divide-y divide-grid text-sm">
                {meeting.recordings.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span>{r.fileName} <span className="text-xs text-ink-3">({(r.size / 1048576).toFixed(1)} MB · {fmtDateTime(r.createdAt)})</span></span>
                    <Badge>{r.status === "ENVIADO" ? "Aguardando transcrição" : r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <form action={uploadRecording.bind(null, meeting.id)} className="flex flex-wrap gap-2">
                <input type="file" name="file" accept=".mp3,.m4a,.wav,audio/*" required className="text-sm" />
                <button className={btnSecondary}>Enviar gravação</button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Participantes">
            {meeting.participants.length ? (
              <ul className="mb-3 space-y-1 text-sm">
                {meeting.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className={p.present ? "" : "text-ink-3 line-through"}>{p.name}{p.role && <span className="text-xs text-ink-3"> · {p.role}</span>}</span>
                    {editable && (
                      <span className="flex gap-2">
                        <form action={togglePresence.bind(null, meeting.id, p.id)}><button className="text-xs text-ink-3 underline">{p.present ? "Ausente" : "Presente"}</button></form>
                        <form action={removeParticipant.bind(null, meeting.id, p.id)}><button className="text-xs text-accent-ink underline">×</button></form>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nenhum participante.</Empty>
            )}
            {editable && (
              <form action={addParticipant.bind(null, meeting.id)} className="mt-3 space-y-2">
                <select name="userId" className={input} defaultValue="">
                  <option value="">Usuário do portal (opcional)</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                </select>
                <input name="name" placeholder="ou nome do participante externo" className={input} autoComplete="off" />
                <input name="role" placeholder="Papel (Presidente, Secretário…)" className={input} autoComplete="off" />
                <button className={`${btnSecondary} w-full`}>Adicionar participante</button>
                <p className="text-xs text-ink-3">Escolha um usuário do portal ou digite o nome; o papel é opcional.</p>
              </form>
            )}
          </Card>

          <Card title="Ações desta reunião">
            {meeting.actions.length ? (
              <ul className="space-y-1 text-sm">
                {meeting.actions.map((a) => (
                  <li key={a.id}><Link href={`/acoes/${a.id}`} className="hover:underline">{a.title}</Link> <span className="text-xs text-ink-3">· {ACTION_STATUS_LABEL[a.status]}</span></li>
                ))}
              </ul>
            ) : <Empty>Nenhuma ação gerada.</Empty>}
          </Card>

          <Card title="Documentos vinculados">
            {meeting.documents.length ? (
              <ul className="space-y-1 text-sm">
                {meeting.documents.map((l) => <li key={l.id}><Link href={`/biblioteca/${l.documentId}`} className="hover:underline">{l.document.title}</Link></li>)}
              </ul>
            ) : <Empty>Nenhum documento.</Empty>}
            {editable && <Link href={`/biblioteca/novo?meetingId=${meeting.id}`} className="mt-2 inline-block text-sm text-accent">+ Enviar documento</Link>}
          </Card>

          <Card title="Versões aprovadas">
            {minutes?.versions.length ? (
              <ul className="space-y-1 text-sm">
                {minutes.versions.map((v) => (
                  <li key={v.id}>
                    <a href={`/reunioes/${meeting.id}/pdf?versao=${v.number}`} target="_blank" className="hover:underline">Versão {v.number}</a>
                    <span className="text-xs text-ink-3"> · {v.approvedBy?.name ?? "—"} · {fmtDateTime(v.approvedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty>Ainda não aprovada.</Empty>}
          </Card>

          {editable && (
            <details id="editar" className="rounded-brand border border-line bg-surface p-5">
              <summary className="cursor-pointer font-display text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Atualizar dados da reunião</summary>
              <form action={updateMeeting.bind(null, meeting.id)} className="mt-4 space-y-4">
                <MeetingFields directorates={directorates} meeting={meeting} />
                <SubmitButton className={btnPrimary}>Salvar</SubmitButton>
              </form>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <form action={archiveMeeting.bind(null, meeting.id)}>
                  <SubmitButton className={btnSecondary} pendingText="Aguarde…">{meeting.archivedAt ? "Desarquivar reunião" : "Arquivar reunião"}</SubmitButton>
                </form>
                {meeting.actions.length === 0 ? (
                  <form action={deleteMeeting.bind(null, meeting.id)}>
                    <ConfirmButton className={btnDanger} message={`Remover a reunião "${meeting.title}" e sua ata? Esta ação não pode ser desfeita.`}>Remover reunião</ConfirmButton>
                  </form>
                ) : (
                  <span className="self-center text-xs text-ink-3">Para remover, antes desvincule as {meeting.actions.length} ação(ões) do plano — ou arquive.</span>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
