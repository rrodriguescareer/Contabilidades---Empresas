'use server';
import { revalidatePath } from 'next/cache';
import { empresaDaSessao } from './auth';
import { adminClient } from './admin-client';
import { avisarGabinete, GESTAO } from './email';
import { concluirEnvios, entregaDoToken, prepararLugares } from './entrega-servidor';
import type { Anuncio, Concluido, Estado, Lugar } from './envios';

/* As duas portas da mesma entrega: a ligação do email e a sessão no portal. */

const SEM_LIGACAO = { erro: 'Esta ligação já não está ativa.' };

/* Quem entrega pela ligação não tem conta. Uma ligação reencaminhada ou
   perdida não pode servir para encher o arquivo nem a caixa do contabilista:
   há um teto por dia, por empresa e por pedido. */
const TETO_DOCUMENTOS = 300;
const TETO_MENSAGENS = 10;
const haUmDia = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export async function prepararPelaLigacao(token: string, pendencia: string | null, ficheiros: Anuncio[]): Promise<{ erro: string } | { lugares: Lugar[] }> {
  const e = await entregaDoToken(token);
  if (e.estado !== 'aberto') return SEM_LIGACAO;
  const { count } = await adminClient().from('empresa_documentos').select('id', { count: 'exact', head: true })
    .eq('company_id', e.empresa_id).is('enviado_por', null).gte('criado_em', haUmDia());
  if ((count ?? 0) + (Array.isArray(ficheiros) ? ficheiros.length : 0) > TETO_DOCUMENTOS) {
    return { erro: 'Já foram entregues muitos documentos hoje por esta ligação. Tente amanhã ou fale com o contabilista.' };
  }
  return prepararLugares(e.empresa_id, pendencia, ficheiros, null);
}

export async function concluirPelaLigacao(token: string, ids: string[], falhados: string[]): Promise<Concluido> {
  const e = await entregaDoToken(token);
  if (e.estado !== 'aberto') return SEM_LIGACAO;
  return concluirEnvios({ id: e.empresa_id, nome: e.empresa }, ids, falhados, 'Cliente (ligação do email)');
}

export async function responderPelaLigacao(token: string, texto: string): Promise<Estado> {
  const e = await entregaDoToken(token);
  if (e.estado !== 'aberto') return SEM_LIGACAO;
  const mensagem = String(texto || '').trim().slice(0, 2000);
  if (!mensagem) return { erro: 'Escreva a sua mensagem.' };
  const { count } = await adminClient().from('secretaria_respostas').select('id', { count: 'exact', head: true })
    .eq('processo_id', e.processo).gte('criado_em', haUmDia());
  if ((count ?? 0) >= TETO_MENSAGENS) return { erro: 'Já enviou várias mensagens hoje. Para falar com o contabilista, responda ao email que recebeu.' };
  const { error } = await adminClient().rpc('secretaria_responder', { p_processo: e.processo, p_texto: mensagem, quem: 'Cliente (ligação do email)' });
  if (error) return { erro: 'Não foi possível enviar a mensagem.' };
  await avisarGabinete({
    chave: `entrega-resposta:${e.processo}:${Date.now()}`, assunto: `Resposta a um pedido de documentos — ${e.empresa}`,
    titulo: 'Um cliente respondeu ao pedido.', paragrafos: [`${e.empresa} escreveu:`, mensagem],
    botao: { texto: 'Abrir a ficha do cliente', url: `${GESTAO}/secretaria/clientes/${e.empresa_id}?aba=historico` },
  });
  return { ok: 'Mensagem enviada. Obrigado.' };
}

export async function prepararNoPortal(empresaId: string, pendencia: string | null, ficheiros: Anuncio[]): Promise<{ erro: string } | { lugares: Lugar[] }> {
  const { empresa, user } = await empresaDaSessao(empresaId);
  return prepararLugares(empresa.id, pendencia, ficheiros, user.id);
}

export async function concluirNoPortal(empresaId: string, ids: string[], falhados: string[]): Promise<Concluido> {
  const { empresa, contexto } = await empresaDaSessao(empresaId);
  const fim = await concluirEnvios({ id: empresa.id, nome: empresa.nome }, ids, falhados, contexto.email);
  revalidatePath(`/app/${empresa.id}`, 'layout');
  return fim;
}
