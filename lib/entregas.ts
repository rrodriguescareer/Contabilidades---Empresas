'use server';
import { revalidatePath } from 'next/cache';
import { empresaDaSessao } from './auth';
import { adminClient } from './admin-client';
import { avisarGabinete, GESTAO } from './email';
import { concluirEnvios, entregaDoToken, prepararLugares } from './entrega-servidor';
import type { Anuncio, Concluido, Estado, Lugar } from './envios';

/* As duas portas da mesma entrega: a ligação do email e a sessão no portal. */

const SEM_LIGACAO = { erro: 'Esta ligação já não está ativa.' };

export async function prepararPelaLigacao(token: string, pendencia: string | null, ficheiros: Anuncio[]): Promise<{ erro: string } | { lugares: Lugar[] }> {
  const e = await entregaDoToken(token);
  if (e.estado !== 'aberto') return SEM_LIGACAO;
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
