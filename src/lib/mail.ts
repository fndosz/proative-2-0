import "server-only";
import { db } from "./db";

/**
 * Envio de e-mail do portal. Provedores, na ordem:
 *  1. Resend  — RESEND_API_KEY + MAIL_FROM (domínio verificado no Resend)
 *  2. Microsoft Graph — envia da caixa do administrador logado (token da conta Microsoft com Mail.Send)
 * Sem provedor configurado, o portal oferece o botão "Abrir no Outlook" com o e-mail pronto (mailto).
 */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://proative-2-0.vercel.app";
export const MAIL_CC = (process.env.MAIL_CC ?? "fernando.souza@proativetec.com.br").split(",").map((s) => s.trim()).filter(Boolean);

export type Mail = { to: string; cc?: string[]; subject: string; text: string; html: string };
export type SendResult = { sent: true; provider: string } | { sent: false; reason: string };

const ROLE_TXT: Record<string, string> = {
  ADMIN: "Administrador — acesso total, inclusive usuários e permissões",
  DIRETORIA: "Diretoria — edita e aprova atas nas suas diretorias",
  CONSULTOR: "Consultor — edita nas diretorias liberadas",
  LEITOR: "Leitor — consulta reuniões, atas, ações e documentos",
};

export function buildInviteEmail(p: { email: string; role: string; directorates: string[]; invitedBy: string }): Mail {
  const dirs = p.directorates.length ? p.directorates.join(", ") : "Geral (todas as diretorias visíveis ao perfil)";
  const subject = "Seu acesso ao Proative 2.0 — portal de governança";
  const text = `Olá,

Você foi convidado(a) por ${p.invitedBy} para o Proative 2.0, o portal de governança da Proative: reuniões, atas, plano de ação, anotações e biblioteca das diretorias.

Como entrar
1. Acesse ${APP_URL}
2. Clique em "Entrar com Microsoft 365"
3. Use a conta ${p.email} (a mesma do seu e-mail e Teams)

Seu acesso
- Perfil: ${ROLE_TXT[p.role] ?? p.role}
- Diretorias: ${dirs}

Não é preciso criar senha: o portal usa o login da Microsoft. Se aparecer "e-mail não convidado", responda este e-mail informando o endereço exato que a sua conta Microsoft mostra.

Primeiros passos
- Painel geral: andamento, próximas reuniões e pendências
- Reuniões e atas: abra uma reunião, cole a transcrição e use "Gerar ata com IA"
- Anotações: registre conversas sem ata formal

Dúvidas: ${MAIL_CC[0] ?? "fernando.souza@proativetec.com.br"}

Proative Soluções em Tecnologia da Informação`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;color:#373d42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e4e6;border-radius:10px;overflow:hidden">
  <tr><td style="background:#eb0029;height:8px"></td></tr>
  <tr><td style="padding:28px 32px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c80023">Proative 2.0</div>
    <h1 style="margin:4px 0 0;font-size:22px;line-height:1.2;color:#373d42">Seu acesso ao portal de governança</h1>
  </td></tr>
  <tr><td style="padding:8px 32px 0;font-size:14px;line-height:1.55;color:#565d63">
    <p style="margin:0 0 12px">Olá,</p>
    <p style="margin:0 0 12px">Você foi convidado(a) por <b>${esc(p.invitedBy)}</b> para o <b>Proative 2.0</b>: reuniões, atas, plano de ação, anotações e biblioteca das diretorias, em um só lugar.</p>
  </td></tr>
  <tr><td style="padding:8px 32px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fde5e9;border-radius:8px;width:100%"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.6">
      <b style="color:#373d42">Como entrar</b><br>
      1. Acesse <a href="${APP_URL}" style="color:#c80023;font-weight:600">${APP_URL.replace("https://", "")}</a><br>
      2. Clique em <b>Entrar com Microsoft 365</b><br>
      3. Use a conta <b>${esc(p.email)}</b> (a mesma do e-mail e do Teams)
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:8px 32px;font-size:14px;line-height:1.6;color:#565d63">
    <b style="color:#373d42">Seu acesso</b><br>
    Perfil: ${esc(ROLE_TXT[p.role] ?? p.role)}<br>
    Diretorias: ${esc(dirs)}
  </td></tr>
  <tr><td style="padding:8px 32px;font-size:13px;line-height:1.6;color:#565d63">
    Não é preciso criar senha — o portal usa o login da Microsoft. Se aparecer <i>“e-mail não convidado”</i>, responda este e-mail informando o endereço exato que a sua conta Microsoft mostra.
  </td></tr>
  <tr><td style="padding:12px 32px 4px;font-size:13px;line-height:1.6;color:#565d63">
    <b style="color:#373d42">Primeiros passos</b><br>
    • <b>Painel geral</b>: andamento, próximas reuniões e pendências<br>
    • <b>Reuniões e atas</b>: abra uma reunião, cole a transcrição e use <i>Gerar ata com IA</i><br>
    • <b>Anotações</b>: registre conversas sem ata formal
  </td></tr>
  <tr><td style="padding:20px 32px 28px">
    <a href="${APP_URL}" style="display:inline-block;background:#eb0029;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:8px">Acessar o Proative 2.0</a>
  </td></tr>
  <tr><td style="padding:14px 32px;border-top:1px solid #e2e4e6;font-size:11px;color:#787f84">
    Proative Soluções em Tecnologia da Informação · Dúvidas: ${esc(MAIL_CC[0] ?? "")}
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return { to: p.email, cc: MAIL_CC, subject, text, html };
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Link mailto com o e-mail pronto, para enviar pelo Outlook quando não há provedor. */
export function mailtoLink(m: Mail) {
  const q = new URLSearchParams({ cc: (m.cc ?? []).join(","), subject: m.subject, body: m.text });
  return `mailto:${m.to}?${q.toString().replace(/\+/g, "%20")}`;
}

export async function sendMail(m: Mail, senderUserId?: string): Promise<SendResult> {
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return sendViaResend(m);
  if (senderUserId) {
    const r = await sendViaGraph(m, senderUserId);
    if (r.sent || r.reason !== "sem-token") return r;
  }
  return { sent: false, reason: "Nenhum serviço de e-mail configurado (RESEND_API_KEY + MAIL_FROM, ou conta Microsoft com permissão Mail.Send)." };
}

async function sendViaResend(m: Mail): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], cc: m.cc, subject: m.subject, html: m.html, text: m.text }),
  });
  if (res.ok) return { sent: true, provider: "resend" };
  return { sent: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
}

/** Envia pela caixa do próprio administrador (Microsoft Graph /me/sendMail), renovando o token se preciso. */
async function sendViaGraph(m: Mail, userId: string): Promise<SendResult> {
  const acc = await db.account.findFirst({ where: { userId, provider: "microsoft-entra-id" } });
  if (!acc?.access_token || !acc.scope?.includes("Mail.Send")) return { sent: false, reason: "sem-token" };
  let token = acc.access_token;
  if (acc.expires_at && acc.expires_at * 1000 < Date.now() + 60_000) {
    if (!acc.refresh_token) return { sent: false, reason: "Token da conta Microsoft expirado; saia e entre de novo no portal." };
    const tenant = (process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "").match(/microsoftonline\.com\/([^/]+)/)?.[1] ?? "common";
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
        client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
        refresh_token: acc.refresh_token,
        scope: "openid profile email offline_access User.Read Mail.Send",
      }),
    });
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
    if (!j.access_token) return { sent: false, reason: `Não foi possível renovar o token Microsoft: ${j.error_description ?? r.status}` };
    token = j.access_token;
    await db.account.update({
      where: { id: acc.id },
      data: { access_token: j.access_token, refresh_token: j.refresh_token ?? acc.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600) },
    });
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: m.subject,
        body: { contentType: "HTML", content: m.html },
        toRecipients: [{ emailAddress: { address: m.to } }],
        ccRecipients: (m.cc ?? []).map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  });
  if (res.status === 202) return { sent: true, provider: "microsoft-graph" };
  return { sent: false, reason: `Microsoft Graph ${res.status}: ${(await res.text()).slice(0, 200)}` };
}
