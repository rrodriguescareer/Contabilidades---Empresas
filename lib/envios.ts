'use server';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { empresaDaSessao } from './auth';
import { CATEGORIAS } from './categorias';
import { avisarGabinete, GESTAO } from './email';
import { mesAno } from './formato';
import { tipoReal } from './tipos-ficheiro';

/* Os envios de ficheiros, em dois tempos, sem o ficheiro passar por aqui.
 *
 * O Vercel recusa pedidos com mais de 4,5 MB, por isso o ficheiro vai do
 * browser diretamente para o Storage. 1) Preparar: regista cada ficheiro
 * (pendente) e devolve um endereço de carregamento assinado, que a política do
 * Storage só concede a quem o registou. 2) Concluir: confirma pelos primeiros
 * bytes que o ficheiro é mesmo um PDF ou uma imagem, e a base confirma o tipo e
 * o tamanho reais antes de o dar por recebido. */

export type Estado = { ok?: string; erro?: string } | null;
/** O fim de um envio: a mensagem e os ficheiros que o servidor recusou. */
export type Concluido = { ok?: string; erro?: string; recusados?: string[] };
export type Anuncio = { nome: string; mime: string; tamanho: number; original?: number };
export type Lugar = { nome: string; id?: string; url?: string; erro?: string };
type Contexto = 'pessoal' | 'comprovativo';

const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAXIMO = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET_DOCUMENTOS = 'empresas-documentos';
const BUCKET_FICHEIROS = 'empresas-ficheiros';
const LIMITE: Record<'documentos' | Contexto, number> = { documentos: 20, pessoal: 10, comprovativo: 5 };

const hojeEmLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
const limpo = (nome: unknown) => String(nome || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200) || 'documento';

function invalido(f: Anuncio) {
  if (!MIMES.includes(f.mime)) return 'só se aceitam PDF, JPEG, PNG ou WebP';
  if (!Number.isInteger(f.tamanho) || f.tamanho < 1) return 'ficheiro vazio';
  if (f.tamanho > MAXIMO) return 'tem mais de 10 MB';
  return null;
}

/** Os primeiros bytes do que chegou ao Storage, para confirmar o tipo. */
async function cabeca(client: SupabaseClient, bucket: string, caminho: string) {
  const { data } = await client.storage.from(bucket).createSignedUrl(caminho, 60);
  if (!data?.signedUrl) return null;
  const r = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-15' }, cache: 'no-store' }).catch(() => null);
  if (!r?.ok || !r.body) return null;
  const leitor = r.body.getReader();
  const { value } = await leitor.read();
  void leitor.cancel().catch(() => {});
  return value ?? null;
}

/* ------------------------------------------------------------ documentos */

export async function prepararDocumentos(empresaId: string, mes: string, categoria: string, nota: string, ficheiros: Anuncio[]):
  Promise<{ erro: string } | { lugares: Lugar[] }> {
  const { client, empresa } = await empresaDaSessao(empresaId);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { erro: 'Escolha o mês dos documentos.' };
  if (!CATEGORIAS.some((c) => c.valor === categoria)) return { erro: 'Escolha o tipo de documentos.' };
  if (!Array.isArray(ficheiros) || !ficheiros.length) return { erro: 'Escolha pelo menos um ficheiro.' };
  if (ficheiros.length > LIMITE.documentos) return { erro: `Envie no máximo ${LIMITE.documentos} ficheiros de cada vez.` };

  const lugares: Lugar[] = [];
  for (const f of ficheiros) {
    const nome = limpo(f?.nome);
    const erro = invalido(f);
    if (erro) { lugares.push({ nome, erro }); continue; }
    const { data: p, error } = await client.rpc('preparar_documento_empresa', {
      empresa: empresa.id, mes: `${mes}-01`, categoria, nome, mime: f.mime, tamanho: f.tamanho,
      tamanho_original: Number.isInteger(f.original) && f.original! > 0 ? f.original : null, nota: String(nota || '').trim().slice(0, 500) || null,
    });
    if (error || !p?.caminho) {
      const m = error?.message || '';
      if (/fechado/i.test(m)) return { erro: 'O contabilista fechou este mês para envios.' };
      if (/início/i.test(m)) return { erro: 'Este mês é anterior ao início do acompanhamento.' };
      if (/Demasiados/i.test(m)) return { erro: 'Há demasiados envios em curso. Espere uns minutos e tente de novo.' };
      lugares.push({ nome, erro: /Mês inválido/.test(m) ? 'mês inválido' : 'não foi possível registar' });
      continue;
    }
    const { data: s } = await client.storage.from(BUCKET_DOCUMENTOS).createSignedUploadUrl(p.caminho);
    if (!s?.signedUrl) {
      await client.rpc('eliminar_documento_empresa', { documento: p.id });
      lugares.push({ nome, erro: 'não foi possível preparar o envio' });
      continue;
    }
    lugares.push({ nome, id: p.id, url: s.signedUrl });
  }
  return { lugares };
}

export async function concluirDocumentos(empresaId: string, mes: string, ids: string[], falhados: string[] = []): Promise<Concluido> {
  const { client, contexto, empresa } = await empresaDaSessao(empresaId);
  const todos = [...ids, ...falhados].filter((x) => UUID.test(String(x)));
  const { data: linhas } = todos.length
    ? await client.from('empresa_documentos').select('id,nome,caminho,mime,estado').eq('company_id', empresa.id).in('id', todos)
    : { data: [] as { id: string; nome: string; caminho: string; mime: string; estado: string }[] };
  const porId = new Map((linhas ?? []).map((l) => [l.id, l]));

  // O que o browser não conseguiu carregar sai já, ficheiro e registo.
  for (const id of falhados) {
    const l = porId.get(id);
    if (!l || l.estado !== 'pendente') continue;
    await client.storage.from(BUCKET_DOCUMENTOS).remove([l.caminho]);
    await client.rpc('eliminar_documento_empresa', { documento: l.id });
  }

  let enviados = 0;
  let atrasados = 0;
  const falhas: string[] = [];
  const recusados: string[] = [];
  for (const id of ids) {
    const l = porId.get(id);
    if (!l) { recusados.push(id); continue; }
    if (l.estado === 'pendente') {
      const bytes = await cabeca(client, BUCKET_DOCUMENTOS, l.caminho);
      if (!bytes || tipoReal(bytes) !== l.mime) {
        await client.storage.from(BUCKET_DOCUMENTOS).remove([l.caminho]);
        await client.rpc('eliminar_documento_empresa', { documento: l.id });
        falhas.push(`${l.nome}: ${bytes ? 'não é um PDF nem uma imagem' : 'o ficheiro não chegou'}`);
        recusados.push(l.id);
        continue;
      }
    }
    const { data: fim, error } = await client.rpc('concluir_documento_empresa', { documento: l.id });
    if (error) { falhas.push(`${l.nome}: o envio não ficou concluído`); recusados.push(l.id); continue; }
    enviados++;
    if (fim?.atrasado) atrasados++;
  }

  if (enviados && !contexto.is_staff) {
    const quem = contexto.nome || contexto.email;
    await avisarGabinete({
      chave: `${atrasados ? 'empresa-docs-atraso' : 'empresa-docs'}:${empresa.id}:${mes}:${hojeEmLisboa()}`,
      assunto: atrasados ? `Documentos fora do prazo — ${empresa.nome}` : `Documentos de ${mesAno(`${mes}-01`)} — ${empresa.nome}`,
      titulo: atrasados ? 'Chegaram documentos fora do prazo.' : 'Chegaram documentos novos.',
      paragrafos: [
        `${quem} enviou documentos de ${mesAno(`${mes}-01`)} da empresa ${empresa.nome} (NIF ${empresa.nif}).`,
        atrasados ? `${atrasados} chegaram depois do dia 10 e ficaram marcados como fora do prazo.` : 'Pode haver mais envios hoje: este aviso sai uma vez por dia.',
      ],
      botao: { texto: 'Ver na gestão', url: `${GESTAO}/empresas/${empresa.id}?aba=documentos&mes=${mes}` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');

  if (!enviados) return { erro: falhas.join(' · ') || 'Nada foi enviado.', recusados };
  const partes = [`${enviados} ${enviados === 1 ? 'documento enviado' : 'documentos enviados'}.`];
  if (atrasados) partes.push(`${atrasados === enviados ? 'Chegaram' : `${atrasados} chegaram`} depois do prazo do dia 10 e ficam marcados como fora do prazo; o contabilista foi avisado.`);
  if (falhas.length) partes.push(`Não foram enviados: ${falhas.join(' · ')}.`);
  return { ok: partes.join(' '), recusados };
}

/* ------------------------------------------- pessoal e comprovativos */

export async function prepararFicheiros(empresaId: string, contextoFicheiro: Contexto, ref: string, ficheiros: Anuncio[]):
  Promise<{ erro: string } | { lugares: Lugar[] }> {
  const { client, empresa } = await empresaDaSessao(empresaId);
  if (!['pessoal', 'comprovativo'].includes(contextoFicheiro) || !UUID.test(ref)) return { erro: 'Pedido inválido.' };
  if (!Array.isArray(ficheiros) || !ficheiros.length) return { erro: 'Escolha pelo menos um ficheiro.' };
  if (ficheiros.length > LIMITE[contextoFicheiro]) return { erro: `Junte no máximo ${LIMITE[contextoFicheiro]} ficheiros.` };

  const lugares: Lugar[] = [];
  for (const f of ficheiros) {
    const nome = limpo(f?.nome);
    const erro = invalido(f);
    if (erro) { lugares.push({ nome, erro }); continue; }
    const { data: p, error } = await client.rpc('preparar_ficheiro_empresa', {
      empresa: empresa.id, p_contexto: contextoFicheiro, p_ref: ref, p_nome: nome, p_mime: f.mime, p_tamanho: f.tamanho,
    });
    if (error || !p?.caminho) { lugares.push({ nome, erro: 'não foi possível registar' }); continue; }
    const { data: s } = await client.storage.from(BUCKET_FICHEIROS).createSignedUploadUrl(p.caminho);
    if (!s?.signedUrl) {
      await client.rpc('apagar_ficheiro_empresa', { ficheiro: p.id });
      lugares.push({ nome, erro: 'não foi possível preparar o envio' });
      continue;
    }
    lugares.push({ nome, id: p.id, url: s.signedUrl });
  }
  return { lugares };
}

export async function concluirFicheiros(empresaId: string, contextoFicheiro: Contexto, ref: string, ids: string[], falhados: string[] = []): Promise<Concluido> {
  const { client, contexto, empresa } = await empresaDaSessao(empresaId);
  if (!UUID.test(ref)) return { erro: 'Pedido inválido.', recusados: ids };
  const todos = [...ids, ...falhados].filter((x) => UUID.test(String(x)));
  const { data: linhas } = todos.length
    ? await client.from('empresa_ficheiros').select('id,nome,caminho,mime,estado,ref_id,contexto').eq('company_id', empresa.id).in('id', todos)
    : { data: [] as { id: string; nome: string; caminho: string; mime: string; estado: string; ref_id: string; contexto: string }[] };
  const porId = new Map((linhas ?? []).filter((l) => l.ref_id === ref && l.contexto === contextoFicheiro).map((l) => [l.id, l]));

  for (const id of falhados) {
    const l = porId.get(id);
    if (!l || l.estado !== 'pendente') continue;
    await client.storage.from(BUCKET_FICHEIROS).remove([l.caminho]);
    await client.rpc('apagar_ficheiro_empresa', { ficheiro: l.id });
  }

  let enviados = 0;
  const falhas: string[] = [];
  const recusados: string[] = [];
  for (const id of ids) {
    const l = porId.get(id);
    if (!l) { recusados.push(id); continue; }
    if (l.estado === 'pendente') {
      const bytes = await cabeca(client, BUCKET_FICHEIROS, l.caminho);
      if (!bytes || tipoReal(bytes) !== l.mime) {
        await client.storage.from(BUCKET_FICHEIROS).remove([l.caminho]);
        await client.rpc('apagar_ficheiro_empresa', { ficheiro: l.id });
        falhas.push(`${l.nome}: ${bytes ? 'não é um PDF nem uma imagem' : 'o ficheiro não chegou'}`);
        recusados.push(l.id);
        continue;
      }
    }
    const { error } = await client.rpc('concluir_ficheiro_empresa', { ficheiro: l.id });
    if (error) { falhas.push(`${l.nome}: o envio não ficou concluído`); recusados.push(l.id); continue; }
    enviados++;
  }

  if (enviados && contextoFicheiro === 'comprovativo' && !contexto.is_staff) {
    const { data: i } = await client.from('empresa_impostos').select('tipo,periodo').eq('id', ref).maybeSingle();
    await avisarGabinete({
      chave: `empresa-comprovativo:${ref}:${hojeEmLisboa()}`,
      assunto: `Comprovativo de pagamento — ${empresa.nome}`,
      titulo: 'Chegou um comprovativo de pagamento.',
      paragrafos: [`${contexto.nome || contexto.email} juntou o comprovativo de ${i ? `${i.tipo} ${i.periodo}` : 'um imposto'} da empresa ${empresa.nome}.`],
      botao: { texto: 'Ver na gestão', url: `${GESTAO}/empresas/${empresa.id}?aba=impostos` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');

  if (!enviados) return { erro: falhas.join(' · ') || 'Nada foi enviado.', recusados };
  const texto = contextoFicheiro === 'comprovativo'
    ? 'Comprovativo enviado. O imposto fica marcado como pago.'
    : `${enviados} ${enviados === 1 ? 'documento anexado' : 'documentos anexados'}.`;
  return { ok: falhas.length ? `${texto} Não foram enviados: ${falhas.join(' · ')}.` : texto, recusados };
}
