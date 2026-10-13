/**
 * Envio de e-mails transacionais (redefinição de senha).
 *
 * Usa a API HTTP do Brevo (v3, `smtp/email`) por `fetch`, sem dependência extra. Fica ativo quando existem
 * a chave (`BREVO_API_KEY`; o nome antigo `brevo` do .env também vale) e o remetente (`EMAIL_FROM`,
 * "Nome <email>" ou só o e-mail, que precisa estar verificado no Brevo). Sem eles, `emailEnabled()` é falso
 * e o chamador decide o que fazer (hoje: registrar o link no log do servidor).
 */

const brevoKey = () => (process.env.BREVO_API_KEY ?? process.env.brevo ?? '').trim()

/** Aceita `Nome <email@dominio>` ou `email@dominio`. Retorna null se não houver um e-mail válido. */
export function parseSender(value: string | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>$/) ?? raw.match(/^()([^<>\s]+@[^<>\s]+)$/)
  if (!match) return null
  const name = match[1]?.trim()
  return { name: name || undefined, email: match[2] }
}

export function emailEnabled() {
  return Boolean(brevoKey() && parseSender(process.env.EMAIL_FROM))
}

export type OutgoingEmail = { to: string; subject: string; html: string; text: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function buildPasswordResetEmail({ name, url }: { name?: string | null; url: string }): Omit<OutgoingEmail, 'to'> {
  const greeting = name?.trim() ? `Olá, ${name.trim().split(/\s+/)[0]}.` : 'Olá.'
  const safeUrl = escapeHtml(url)
  return {
    subject: 'Redefinir sua senha no Garimpo certo',
    text: `${greeting}\n\nRecebemos um pedido para redefinir a senha da sua conta no Garimpo certo.\nPara escolher uma nova senha, abra o link abaixo (ele vale por 1 hora):\n\n${url}\n\nSe você não fez esse pedido, pode ignorar este e-mail: sua senha continua a mesma.\n`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fbfaf7;font-family:Arial,Helvetica,sans-serif;color:#1c2434">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e0d7;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 8px;font-size:15px;color:#596273">${escapeHtml(greeting)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Redefinir sua senha</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6">Recebemos um pedido para redefinir a senha da sua conta no Garimpo certo. O link abaixo vale por 1 hora.</p>
<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#c3441d;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">Escolher nova senha</a></p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#596273">Se você não fez esse pedido, pode ignorar este e-mail: sua senha continua a mesma.</p>
</td></tr></table></td></tr></table></body></html>`,
  }
}

export function buildInviteEmail({ url, role, days }: { url: string; role: string; days: number }): Omit<OutgoingEmail, 'to'> {
  const safeUrl = escapeHtml(url)
  const safeRole = escapeHtml(role)
  return {
    subject: 'Convite para a equipe do Garimpo certo',
    text: `Olá.\n\nVocê foi convidado para a equipe do Garimpo certo com o papel ${role}.\nPara aceitar, abra o link abaixo, entre (ou crie sua conta) com este mesmo e-mail e confirme. O convite vale por ${days} dias:\n\n${url}\n\nSe você não esperava este convite, pode ignorar este e-mail.\n`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fbfaf7;font-family:Arial,Helvetica,sans-serif;color:#1c2434">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e0d7;border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Você foi convidado para a equipe</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6">Papel: <strong>${safeRole}</strong>. Para aceitar, entre (ou crie sua conta) com este mesmo e-mail e confirme. O convite vale por ${days} dias.</p>
<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#c3441d;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">Aceitar convite</a></p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#596273">Se você não esperava este convite, pode ignorar este e-mail.</p>
</td></tr></table></td></tr></table></body></html>`,
  }
}

/** Retorna true quando o provedor aceitou a mensagem. Nunca lança: falha de e-mail não deve quebrar o fluxo de autenticação. */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const sender = parseSender(process.env.EMAIL_FROM)
  if (!brevoKey() || !sender) return false
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoKey(), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: email.to }], subject: email.subject, htmlContent: email.html, textContent: email.text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { code?: string; message?: string } | null
      console.error(`[email] Brevo recusou o envio (HTTP ${response.status}${detail?.code ? `, ${detail.code}` : ''}${detail?.message ? `: ${detail.message}` : ''})`)
      return false
    }
    return true
  } catch (error) {
    console.error('[email] falha ao enviar', error instanceof Error ? error.message : error)
    return false
  }
}
