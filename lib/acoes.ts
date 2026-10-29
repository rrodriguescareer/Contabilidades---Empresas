'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { empresaDaSessao } from './auth';
import { comprimirDocumento } from './comprimir';
import { avisarGabinete, GESTAO } from './email';
import { mesAno } from './formato';
import { CATEGORIAS } from './categorias';

export type Estado = { ok?: string; erro?: string } | null;

const BUCKET = 'empresas-documentos';
const MAXIMO_ORIGINAL = 25 * 1024 * 1024; // as fotografias encolhem muito ao passar a WebP
const MAXIMO_GUARDADO = 10 * 1024 * 1024;
const MAXIMO_FICHEIROS = 20;

const texto = (form: FormData, nome: string) => String(form.get(nome) || '').trim();
const hojeEmLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());

/** O tipo real do ficheiro, pelos primeiros bytes: a extensão e o tipo que o
    browser declara não chegam. */
function tipoReal(b: Uint8Array): string | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** Envia os documentos de um mês: valida, comprime as imagens, regista,
    carrega para o Storage privado e conclui. Avisa o gabinete uma vez por dia
    e por mês, e de novo se alguma coisa chegar fora do prazo. */
export async function enviarDocumentos(_anterior: Estado, form: FormData): Promise<Estado> {
  const { client, contexto, empresa } = await empresaDaSessao(texto(form, 'empresa'));
  const mes = texto(form, 'mes');
  const categoria = texto(form, 'categoria');
  const nota = texto(form, 'nota').slice(0, 500);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { erro: 'Escolha o mês dos documentos.' };
  if (!CATEGORIAS.some((c) => c.valor === categoria)) return { erro: 'Escolha o tipo de documentos.' };
  const ficheiros = form.getAll('ficheiros').filter((f): f is File => f instanceof File && f.size > 0);
  if (!ficheiros.length) return { erro: 'Escolha pelo menos um ficheiro.' };
  if (ficheiros.length > MAXIMO_FICHEIROS) return { erro: `Envie no máximo ${MAXIMO_FICHEIROS} ficheiros de cada vez.` };

  let enviados = 0;
  let atrasados = 0;
  const falhas: string[] = [];
  for (const ficheiro of ficheiros) {
    const nome = ficheiro.name.slice(0, 200) || 'documento';
    if (ficheiro.size > MAXIMO_ORIGINAL) { falhas.push(`${nome}: tem mais de 25 MB`); continue; }
    const original = new Uint8Array(await ficheiro.arrayBuffer());
    const mime = tipoReal(original);
    if (!mime) { falhas.push(`${nome}: só se aceitam PDF, JPEG, PNG ou WebP`); continue; }
    const pronto = await comprimirDocumento(original, mime);
    if (pronto.bytes.byteLength > MAXIMO_GUARDADO) { falhas.push(`${nome}: o PDF tem mais de 10 MB`); continue; }
    const nomeFinal = pronto.convertido ? `${nome.replace(/\.[^.]+$/, '')}.webp` : nome;

    const { data: preparado, error: semRegisto } = await client.rpc('preparar_documento_empresa', {
      empresa: empresa.id, mes: `${mes}-01`, categoria, nome: nomeFinal, mime: pronto.mime,
      tamanho: pronto.bytes.byteLength, tamanho_original: original.byteLength, nota: nota || null,
    });
    if (semRegisto || !preparado?.caminho) {
      falhas.push(`${nome}: ${/Mês inválido/.test(semRegisto?.message || '') ? 'mês inválido' : 'não foi possível registar'}`);
      continue;
    }
    const { error: semFicheiro } = await client.storage.from(BUCKET)
      .upload(preparado.caminho, pronto.bytes, { contentType: pronto.mime, upsert: false });
    if (semFicheiro) {
      await client.rpc('eliminar_documento_empresa', { documento: preparado.id });
      falhas.push(`${nome}: o envio falhou`);
      continue;
    }
    const { data: fim, error: semFim } = await client.rpc('concluir_documento_empresa', { documento: preparado.id });
    if (semFim) { falhas.push(`${nome}: o envio não ficou concluído`); continue; }
    enviados++;
    if (fim?.atrasado) atrasados++;
  }

  if (enviados && !contexto.is_staff) {
    const hoje = hojeEmLisboa();
    const quem = contexto.nome || contexto.email;
    await avisarGabinete({
      chave: `${atrasados ? 'empresa-docs-atraso' : 'empresa-docs'}:${empresa.id}:${mes}:${hoje}`,
      assunto: atrasados ? `Documentos fora do prazo — ${empresa.nome}` : `Documentos de ${mesAno(`${mes}-01`)} — ${empresa.nome}`,
      titulo: atrasados ? 'Chegaram documentos fora do prazo.' : 'Chegaram documentos novos.',
      paragrafos: [
        `${quem} enviou documentos de ${mesAno(`${mes}-01`)} da empresa ${empresa.nome} (NIF ${empresa.nif}).`,
        atrasados ? `${atrasados} chegaram depois do dia 10 e ficaram marcados como fora do prazo.` : 'Pode haver mais envios hoje: este aviso sai uma vez por dia.',
      ],
      botao: { texto: 'Ver na gestão', url: `${GESTAO}/empresas/${empresa.id}` },
    });
  }
  revalidatePath(`/app/${empresa.id}`, 'layout');

  if (!enviados) return { erro: falhas.join(' · ') || 'Nada foi enviado.' };
  const partes = [`${enviados} ${enviados === 1 ? 'documento enviado' : 'documentos enviados'}.`];
  if (atrasados) partes.push(`${atrasados === enviados ? 'Chegaram' : `${atrasados} chegaram`} depois do prazo do dia 10 e ficam marcados como fora do prazo; o contabilista foi avisado.`);
  if (falhas.length) partes.push(`Não foram enviados: ${falhas.join(' · ')}.`);
  return { ok: partes.join(' ') };
}

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
