'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { empresaDaSessao } from './auth';
import { avisarGabinete, GESTAO } from './email';
import { mesAno } from './formato';

export type Estado = { ok?: string; erro?: string } | null;

const BUCKET = 'empresas-documentos';

const texto = (form: FormData, nome: string) => String(form.get(nome) || '').trim();
const hojeEmLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());

function voltar(empresa: string, mes: string, chave: 'erro' | 'mensagem', texto: string): never {
  redirect(`/app/${empresa}/documentos?mes=${mes}&${chave}=${encodeURIComponent(texto)}`);
}

export async function eliminarDocumento(form: FormData) {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const id = texto(form, 'documento');
  const { data: doc } = await client.from('empresa_documentos').select('id,caminho,mes,estado').eq('id', id).eq('company_id', empresa.id).maybeSingle();
  if (!doc) voltar(empresa.id, texto(form, 'mes'), 'erro', 'Documento indisponível.');
  const mes = String(doc.mes).slice(0, 7);
  if (!['pendente', 'recebido'].includes(doc.estado)) voltar(empresa.id, mes, 'erro', 'Este documento já foi revisto pelo contabilista e não pode ser apagado.');
  // Primeiro o ficheiro (a política só o deixa apagar enquanto a linha existe),
  // depois a linha.
  const { error: semApagar } = await client.storage.from(BUCKET).remove([doc.caminho]);
  if (semApagar) voltar(empresa.id, mes, 'erro', 'Não foi possível apagar o ficheiro.');
  const { error } = await client.rpc('eliminar_documento_empresa', { documento: doc.id });
  if (error) voltar(empresa.id, mes, 'erro', 'Não foi possível apagar o documento.');
  revalidatePath(`/app/${empresa.id}`, 'layout');
  voltar(empresa.id, mes, 'mensagem', 'Documento apagado.');
}

export async function marcarMes(form: FormData) {
  const { client, contexto, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const mes = texto(form, 'mes');
  const completo = texto(form, 'completo') === 'true';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) voltar(empresa.id, mes, 'erro', 'Mês inválido.');
  const { error } = await client.rpc('marcar_mes_completo', { empresa: empresa.id, mes: `${mes}-01`, completo });
  if (error) voltar(empresa.id, mes, 'erro', 'Não foi possível guardar.');
  if (completo && !contexto.is_staff) {
    await avisarGabinete({
      chave: `empresa-mes-completo:${empresa.id}:${mes}:${hojeEmLisboa()}`,
      assunto: `${empresa.nome}: documentos de ${mesAno(`${mes}-01`)} completos`,
      titulo: 'Um mês dado como completo.',
      paragrafos: [`${contexto.nome || contexto.email} indicou que já enviou todos os documentos de ${mesAno(`${mes}-01`)} da empresa ${empresa.nome}.`],
      botao: { texto: 'Conferir na gestão', url: `${GESTAO}/empresas/${empresa.id}` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');
  voltar(empresa.id, mes, 'mensagem', completo ? 'Obrigado. O contabilista foi avisado de que o mês está completo.' : 'O mês voltou a ficar aberto para mais documentos.');
}

export async function enviarMensagem(_anterior: Estado, form: FormData): Promise<Estado> {
  const { client, contexto, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const corpo = String(form.get('corpo') || '').trim();
  if (!corpo) return { erro: 'Escreva a mensagem.' };
  if (corpo.length > 5000) return { erro: 'A mensagem é demasiado longa (máximo 5000 caracteres).' };
  const { data: id, error } = await client.rpc('enviar_mensagem_empresa', { empresa: empresa.id, corpo });
  if (error || !id) return { erro: 'Não foi possível enviar. Tente novamente.' };
  if (!contexto.is_staff) {
    await avisarGabinete({
      chave: `empresa-mensagem:${id}`,
      assunto: `Mensagem de ${empresa.nome}`,
      titulo: `Nova mensagem de ${empresa.nome}.`,
      paragrafos: [`${contexto.nome || contexto.email} escreveu:`, corpo.slice(0, 1500)],
      botao: { texto: 'Responder na gestão', url: `${GESTAO}/empresas/${empresa.id}` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');
  return { ok: 'Mensagem enviada.' };
}
