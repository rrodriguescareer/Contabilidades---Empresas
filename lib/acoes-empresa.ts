'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { empresaDaSessao } from './auth';
import { avisarGabinete, GESTAO } from './email';
import { lerFicha } from './ficha';
import { BUCKET_LOGOTIPOS, prepararLogotipo } from './ficheiros';
import { lerPessoal, TIPOS_PESSOAL } from './pessoal';

/* As ações das secções da empresa: ficha, logótipo, alertas, pessoal e
   impostos. A base volta a verificar o acesso em cada função. */

export type Estado = { ok?: string; erro?: string } | null;

const texto = (form: FormData, nome: string) => String(form.get(nome) || '').trim();

export async function guardarFicha(_anterior: Estado, form: FormData): Promise<Estado> {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const lido = lerFicha(form);
  if ('erro' in lido) return { erro: lido.erro };
  const { data, error } = await client.rpc('guardar_ficha_empresa', { empresa: empresa.id, dados: lido.dados });
  if (error) {
    if (/NIF/.test(error.message)) return { erro: error.message.includes('Já existe') ? 'Já existe outra empresa com este NIF.' : 'NIF inválido.' };
    return { erro: 'Não foi possível guardar. Confirme os campos.' };
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');
  return { ok: data ? `Guardado: ${data} ${data === 1 ? 'campo alterado' : 'campos alterados'}. Fica registado no histórico.` : 'Nada mudou.' };
}

export async function enviarLogotipo(_anterior: Estado, form: FormData): Promise<Estado> {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const ficheiro = form.get('logotipo');
  if (!(ficheiro instanceof File) || !ficheiro.size) return { erro: 'Escolha a imagem do logótipo.' };
  const pronto = await prepararLogotipo(ficheiro);
  if ('erro' in pronto) return { erro: pronto.erro };
  const caminho = `${empresa.id}/logotipo-${Date.now()}.webp`;
  const { error } = await client.storage.from(BUCKET_LOGOTIPOS).upload(caminho, pronto.bytes, { contentType: 'image/webp', upsert: false });
  if (error) return { erro: 'Não foi possível guardar a imagem.' };
  const { data: anterior, error: semRegisto } = await client.rpc('definir_logotipo_empresa', { empresa: empresa.id, caminho });
  if (semRegisto) {
    await client.storage.from(BUCKET_LOGOTIPOS).remove([caminho]);
    return { erro: 'Não foi possível guardar o logótipo.' };
  }
  if (anterior) await client.storage.from(BUCKET_LOGOTIPOS).remove([anterior]);
  revalidatePath(`/app/${empresa.id}`, 'layout');
  return { ok: 'Logótipo guardado. Passa a aparecer no portal e nos documentos gerados.' };
}

export async function retirarLogotipo(form: FormData) {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const { data: anterior } = await client.rpc('definir_logotipo_empresa', { empresa: empresa.id, caminho: null });
  if (anterior) await client.storage.from(BUCKET_LOGOTIPOS).remove([anterior]);
  revalidatePath(`/app/${empresa.id}`, 'layout');
  redirect(`/app/${empresa.id}/dados?mensagem=${encodeURIComponent('Logótipo retirado.')}`);
}

export async function lerAlerta(form: FormData) {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  await client.rpc('ler_alerta_empresa', { alerta: texto(form, 'alerta') });
  revalidatePath(`/app/${empresa.id}`, 'layout');
}

/** Regista a comunicação; os documentos seguem a seguir, diretamente do
    browser para o Storage, ligados ao pedido devolvido. O tipo da comunicação
    vem em «comunicacao»: «tipo» é um dos campos de algumas delas. */
export async function comunicarPessoal(_anterior: Estado, form: FormData): Promise<{ ok?: string; erro?: string; id?: string }> {
  const { client, contexto, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const tipo = texto(form, 'comunicacao');
  const lido = lerPessoal(tipo, form);
  if ('erro' in lido) return { erro: lido.erro };
  const anexos = Math.min(10, Math.max(0, Number(texto(form, 'anexos')) || 0));
  const { data: id, error } = await client.rpc('comunicar_pessoal', {
    empresa: empresa.id, p_tipo: tipo, p_trabalhador: lido.trabalhador, p_dados: lido.dados,
  });
  if (error || !id) return { erro: /não tem trabalhadores/.test(error?.message || '') ? 'Esta empresa não está marcada como tendo trabalhadores.' : 'Não foi possível enviar.' };
  if (!contexto.is_staff) {
    await avisarGabinete({
      chave: `empresa-pessoal:${id}`,
      assunto: `${TIPOS_PESSOAL[tipo].titulo}: ${lido.trabalhador} — ${empresa.nome}`,
      titulo: `Nova comunicação de pessoal: ${TIPOS_PESSOAL[tipo].titulo.toLowerCase()}.`,
      paragrafos: [`${contexto.nome || contexto.email} comunicou ${TIPOS_PESSOAL[tipo].titulo.toLowerCase()} de ${lido.trabalhador} na empresa ${empresa.nome}.`,
        anexos ? `Com ${anexos} documento(s) anexo(s).` : 'Sem documentos anexos.'],
      botao: { texto: 'Tratar na gestão', url: `${GESTAO}/empresas/${empresa.id}?aba=pessoal` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');
  return { ok: 'Comunicação enviada ao contabilista. Acompanhe o estado aqui em baixo.', id };
}

export async function marcarImpostoPago(form: FormData) {
  const { client, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const pago = texto(form, 'pago') === 'true';
  const tipo = texto(form, 'tipo');
  const { error } = await client.rpc('marcar_imposto_pago', { p_id: texto(form, 'imposto'), pago });
  revalidatePath(`/app/${empresa.id}`, 'layout');
  const msg = error ? 'erro=Não foi possível atualizar.' : `mensagem=${encodeURIComponent(pago ? 'Marcado como pago. Junte o comprovativo, se o tiver.' : 'Voltou a ficar por pagar.')}`;
  redirect(`/app/${empresa.id}/impostos?tipo=${encodeURIComponent(tipo)}&${msg}`);
}
