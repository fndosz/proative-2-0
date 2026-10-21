import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export type MinutesSnapshot = {
  meeting: { title: string; type: string; date: string; location: string | null };
  participants: { name: string; role: string | null; present: boolean }[];
  agenda: string;
  discussions: string;
  generalTopics: string;
  decisions: { text: string; status: string }[];
  referrals: { text: string; ownerName: string | null; dueDate: string | null }[];
  closing: string;
};

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.45, color: "#111" },
  brand: { fontSize: 9, color: "#0f3d5e", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meta: { fontSize: 9.5, color: "#555", marginBottom: 14 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4, color: "#0f3d5e" },
  li: { marginBottom: 2 },
  draft: { position: "absolute", top: 20, right: 48, fontSize: 9, color: "#b45309" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#888", flexDirection: "row", justifyContent: "space-between" },
});

const fmt = (iso: string, withTime = true) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "America/Sao_Paulo" }).format(new Date(iso));

function Section({ title, text }: { title: string; text: string }) {
  return (
    <View wrap>
      <Text style={s.h2}>{title}</Text>
      <Text>{text.trim() || "—"}</Text>
    </View>
  );
}

export async function renderMinutesPdf(m: MinutesSnapshot, opts: { label: string; draft: boolean }) {
  const present = m.participants.filter((p) => p.present);
  const absent = m.participants.filter((p) => !p.present);
  return renderToBuffer(
    <Document title={`Ata — ${m.meeting.title}`} author="Proative" language="pt-BR">
      <Page size="A4" style={s.page}>
        {opts.draft && <Text style={s.draft} fixed>RASCUNHO — não aprovada</Text>}
        <Text style={s.brand}>Proative · {m.meeting.type}</Text>
        <Text style={s.title}>Ata — {m.meeting.title}</Text>
        <Text style={s.meta}>{fmt(m.meeting.date)}{m.meeting.location ? ` · ${m.meeting.location}` : ""}</Text>

        <Text style={s.h2}>Participantes</Text>
        {present.length ? present.map((p, i) => <Text key={i} style={s.li}>• {p.name}{p.role ? ` — ${p.role}` : ""}</Text>) : <Text>—</Text>}
        {absent.length > 0 && <Text style={{ marginTop: 4, color: "#555" }}>Ausentes: {absent.map((p) => p.name).join(", ")}</Text>}

        <Section title="Ordem do dia" text={m.agenda} />
        <Section title="Deliberações" text={m.discussions} />
        <Section title="Assuntos gerais" text={m.generalTopics} />

        <Text style={s.h2}>Decisões</Text>
        {m.decisions.length ? m.decisions.map((d, i) => <Text key={i} style={s.li}>{i + 1}. {d.text}{d.status === "PENDENTE" ? " [pendente]" : ""}</Text>) : <Text>—</Text>}

        <Text style={s.h2}>Encaminhamentos</Text>
        {m.referrals.length
          ? m.referrals.map((r, i) => (
              <Text key={i} style={s.li}>{i + 1}. {r.text}{r.ownerName ? ` — Responsável: ${r.ownerName}` : ""}{r.dueDate ? ` — Prazo: ${fmt(r.dueDate, false)}` : ""}</Text>
            ))
          : <Text>—</Text>}

        <Section title="Encerramento" text={m.closing} />

        <View style={s.footer} fixed>
          <Text>{opts.label}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>,
  );
}
