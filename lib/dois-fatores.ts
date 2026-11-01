'use server';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { adminClient, adminConfigured } from './admin-client';
import { enviarAoUtilizador as enviarEmail, PORTAL } from './email';
import { supabase } from './supabase';

/* A autenticação de dois fatores: uma aplicação de autenticação (Google
 * Authenticator, Microsoft Authenticator, Palavras-passe do iPhone…) que dá um
 * código de 6 algarismos a cada 30 segundos. A sessão só chega aos dados
 * depois de passar o código — a base de dados exige-o (migração 065).
 *
 * Desativar pede um código enviado por email: quem tem só a palavra-passe não
 * consegue tirar a proteção. O contabilista também a pode desativar na
 * gestão, confirmando com a sua palavra-passe. */

const interno = (d: unknown) => (typeof d === 'string' && /^\/(?![\/\\])[^\\\s]*$/.test(d) ? d : '/app');
const com = (caminho: string, chave: 'erro' | 'mensagem', texto: string, destino?: string) =>
  `${caminho}?${chave}=${encodeURIComponent(texto)}${destino ? `&destino=${encodeURIComponent(destino)}` : ''}`;
const algarismos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** O código da aplicação, à entrada. */
export async function verificarSegundoFator(form: FormData) {
  const destino = interno(form.get('destino'));
  const codigo = algarismos(form.get('codigo'));
  if (codigo.length !== 6) redirect(com('/verificar', 'erro', 'Indique os 6 algarismos da aplicação.', destino));
  const client = await supabase();
  const { data: fatores } = await client.auth.mfa.listFactors();
  const fator = fatores?.totp?.find((f) => f.status === 'verified');
  if (!fator) redirect(destino);
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) redirect(com('/verificar', 'erro', 'Código errado ou já expirado. Use o código que está agora na aplicação.', destino));
  redirect(destino);
}

/** «Agora não», à pergunta depois da entrada. */
export async function naoAtivarAgora(form: FormData) {
  const client = await supabase();
  if (form.get('nunca') === 'on') await client.rpc('nao_perguntar_mfa', { p_valor: true });
  redirect(interno(form.get('destino')));
}

/** Começa a ativação: um fator novo, ainda por confirmar, com o QR code. */
export async function iniciarAtivacao(): Promise<{ erro: string } | { id: string; qr: string; segredo: string }> {
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { erro: 'A sessão terminou. Entre de novo.' };
  const { data: lista } = await client.auth.mfa.listFactors();
  if (lista?.totp?.some((f) => f.status === 'verified')) return { erro: 'A autenticação de dois fatores já está ativa.' };
  // Uma tentativa anterior que ficou a meio sai, para não acumular.
  for (const f of (lista?.all ?? []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    await client.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp', issuer: 'RR Contabilidade', friendlyName: `RR ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) return { erro: 'Não foi possível começar a ativação. Tente novamente.' };
  return { id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

/** Confirma com o primeiro código: a partir daqui, cada entrada pede-o. */
export async function confirmarAtivacao(id: string, codigo: string): Promise<{ ok?: true; erro?: string }> {
  const c = algarismos(codigo);
  if (c.length !== 6) return { erro: 'Indique os 6 algarismos que aparecem na aplicação.' };
  const client = await supabase();
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: String(id), code: c });
  if (error) return { erro: 'O código não confere. Confirme que a hora do telemóvel está certa e use o código atual.' };
  const { data: { user } } = await client.auth.getUser();
  if (user?.email) {
    await enviarEmail({
      chave: `2fa-ativa:${user.id}:${Date.now()}`, para: user.email,
      assunto: 'Autenticação de dois fatores ativada',
      titulo: 'A sua conta tem agora dois fatores',
      paragrafos: ['A autenticação de dois fatores foi ativada. A partir de agora, cada entrada pede o código da aplicação de autenticação.',
        'Se não foi o próprio a ativá-la, contacte o contabilista de imediato.'],
    }).catch(() => false);
  }
  return { ok: true };
}

const resumo = (codigo: string, utilizador: string) =>
  createHash('sha256').update(`${codigo}:${utilizador}:${process.env.INTEGRATION_ENCRYPTION_KEY || ''}`).digest('hex');

/** Para desativar: um código de 6 algarismos por email, válido 10 minutos. */
export async function pedirCodigoDesativar(): Promise<{ ok?: string; erro?: string }> {
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return { erro: 'A sessão terminou. Entre de novo.' };
  if (!adminConfigured()) return { erro: 'Serviço temporariamente indisponível. Contacte o contabilista.' };
  const admin = adminClient();
  const { count } = await admin.from('codigos_verificacao').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('criado_em', new Date(Date.now() - 15 * 60_000).toISOString());
  if ((count ?? 0) >= 3) return { erro: 'Já pediu vários códigos. Espere 15 minutos e tente de novo.' };
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { error } = await admin.from('codigos_verificacao').insert({
    user_id: user.id, finalidade: 'desativar_2fa', resumo: resumo(codigo, user.id),
    expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return { erro: 'Não foi possível gerar o código. Tente novamente.' };
  const enviado = await enviarEmail({
    chave: `codigo-2fa:${user.id}:${Date.now()}`, para: user.email,
    assunto: 'Código para desativar a autenticação de dois fatores',
    titulo: 'O seu código de confirmação',
    paragrafos: ['Pediu para desativar a autenticação de dois fatores da sua conta. Use este código no portal. É válido durante 10 minutos.',
      'Se não foi o próprio a pedir, ignore este email e altere a palavra-passe.'],
    destaque: { rotulo: 'Código', valor: codigo },
  }).catch(() => false);
  if (!enviado) return { erro: 'Não foi possível enviar o email. Tente novamente dentro de momentos.' };
  return { ok: `Enviámos um código para ${user.email}. É válido durante 10 minutos.` };
}

export async function desativarComCodigo(form: FormData) {
  const voltar = '/conta';
  const codigo = algarismos(form.get('codigo'));
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');
  if (codigo.length !== 6 || !adminConfigured()) redirect(com(voltar, 'erro', 'Indique os 6 algarismos do email.'));
  const admin = adminClient();
  const { data: pedido } = await admin.from('codigos_verificacao').select('id,resumo,tentativas,expira_em')
    .eq('user_id', user.id).eq('finalidade', 'desativar_2fa').is('usado_em', null)
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (!pedido || pedido.tentativas >= 5 || Date.parse(pedido.expira_em) < Date.now()) {
    redirect(com(voltar, 'erro', 'O código expirou. Peça um novo.'));
  }
  const certo = timingSafeEqual(Buffer.from(resumo(codigo, user.id)), Buffer.from(pedido.resumo));
  if (!certo) {
    await admin.from('codigos_verificacao').update({ tentativas: pedido.tentativas + 1 }).eq('id', pedido.id);
    redirect(com(voltar, 'erro', 'Código errado. Confirme o código do email mais recente.'));
  }
  await admin.from('codigos_verificacao').update({ usado_em: new Date().toISOString() }).eq('id', pedido.id);
  const { data: fatores } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  for (const f of fatores?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
  if (user.email) {
    await enviarEmail({
      chave: `2fa-desativada:${user.id}:${Date.now()}`, para: user.email,
      assunto: 'Autenticação de dois fatores desativada',
      titulo: 'A autenticação de dois fatores foi desativada',
      paragrafos: ['A sua conta volta a entrar só com o email e a palavra-passe.', 'Se não foi o próprio, contacte o contabilista de imediato.'],
      botao: { texto: 'Abrir a minha conta', url: `${PORTAL}/conta` },
    }).catch(() => false);
  }
  redirect(com(voltar, 'mensagem', 'Autenticação de dois fatores desativada.'));
}
