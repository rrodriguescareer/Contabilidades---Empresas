import 'server-only';
import { adminClient, adminConfigured } from './admin-client';

/* Avisos ao gabinete por Resend: documentos novos, entregas fora do prazo e
   mensagens. Cada aviso tem uma chave única, gravada antes de enviar, para o
   mesmo aviso nunca sair duas vezes (vários envios no mesmo dia dão um só
   email). Enviar nunca faz falhar a operação que o pediu. */

const REMETENTE = process.env.MAIL_FROM || 'Rúben Meirinho Rodrigues <portal@rr-contabilidade.com>';
const RESPOSTA = 'contabilidade.rubenrodrigues@gmail.com';
export const EMAIL_GABINETE = process.env.EMAIL_GABINETE || RESPOSTA;
export const GESTAO = (process.env.NEXT_PUBLIC_GESTAO_URL || 'https://gestao.rr-contabilidade.com').replace(/\/$/, '');
const LOGOTIPO = (process.env.NEXT_PUBLIC_IRS_URL || 'https://irs.rr-contabilidade.com').replace(/\/$/, '') + '/email-rr.png';

type Aviso = { chave: string; para: string; assunto: string; titulo: string; paragrafos: string[]; botao?: { texto: string; url: string } };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function html(e: Aviso) {
  const p = e.paragrafos.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#33475b">${esc(t)}</p>`).join('');
  const botao = e.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="background:#2867f8;border-radius:999px"><a href="${esc(e.botao.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(e.botao.texto)}</a></td></tr></table>`
    : '';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f3f7fd;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7fd;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4ebf6">
<tr><td style="background:#0a2344;padding:22px 28px"><img src="${LOGOTIPO}" alt="RR." height="36" style="display:block;height:36px;border:0"></td></tr>
<tr><td style="padding:30px 28px 24px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0a2344">${esc(e.titulo)}</h1>${p}${botao}</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid #e4ebf6"><p style="margin:0;font-size:12px;line-height:1.5;color:#7a8aa0">Aviso automático do portal Empresas.</p></td></tr>
</table></td></tr></table></body></html>`;
}

export async function avisarGabinete(e: Omit<Aviso, 'para'>) {
  const chave = process.env.RESEND_API_KEY || '';
  if (!/^re_/.test(chave) || !adminConfigured()) return false;
  const admin = adminClient();
  try {
    const { data: novo } = await admin.from('emails')
      .upsert({ chave: e.chave.slice(0, 200), para: EMAIL_GABINETE, assunto: e.assunto.slice(0, 250) }, { onConflict: 'chave', ignoreDuplicates: true })
      .select('id');
    const id = novo?.[0]?.id;
    if (!id) return false; // já tinha saído
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rr-${id}` },
      body: JSON.stringify({
        from: REMETENTE, to: [EMAIL_GABINETE], reply_to: RESPOSTA, subject: e.assunto, html: html({ ...e, para: EMAIL_GABINETE }),
        text: [e.titulo, '', ...e.paragrafos, ...(e.botao ? ['', `${e.botao.texto}: ${e.botao.url}`] : [])].join('\n'),
      }),
      cache: 'no-store',
    });
    const corpo = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) {
      await admin.from('emails').update({ estado: 'falhou', erro: String(corpo.message || r.status).slice(0, 500) }).eq('id', id);
      return false;
    }
    await admin.from('emails').update({ estado: 'enviado', resend_id: corpo.id || null, enviado_em: new Date().toISOString() }).eq('id', id);
    return true;
  } catch (falha) {
    console.error(JSON.stringify({ event: 'rr_email_falhou', chave: e.chave, erro: String((falha as Error)?.message || falha) }));
    return false;
  }
}
