import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { comprimirDocumento } from './comprimir';
import { tipoReal } from './tipos-ficheiro';

/* Os ficheiros das secções novas (pessoal, recibos, guias, comprovativos):
   o mesmo circuito dos documentos do mês. A linha nasce pendente, o ficheiro
   sobe para o Storage privado com a sessão de quem envia, e a base só o dá
   por carregado depois de o ver lá. Imagens passam a WebP; PDF ficam. */

export const BUCKET_FICHEIROS = 'empresas-ficheiros';
export const BUCKET_LOGOTIPOS = 'empresas-logotipos';
const MAXIMO_ORIGINAL = 25 * 1024 * 1024;
const MAXIMO_GUARDADO = 10 * 1024 * 1024;

export type Contexto = 'pessoal' | 'recibos' | 'guia' | 'comprovativo';

export async function enviarFicheiro(client: SupabaseClient, empresa: string, contexto: Contexto, ref: string, ficheiro: File) {
  const nome = ficheiro.name.slice(0, 200) || 'documento';
  if (ficheiro.size > MAXIMO_ORIGINAL) return { erro: `${nome}: tem mais de 25 MB` };
  const original = new Uint8Array(await ficheiro.arrayBuffer());
  const mime = tipoReal(original);
  if (!mime) return { erro: `${nome}: só se aceitam PDF, JPEG, PNG ou WebP` };
  const pronto = await comprimirDocumento(original, mime);
  if (pronto.bytes.byteLength > MAXIMO_GUARDADO) return { erro: `${nome}: o PDF tem mais de 10 MB` };
  const nomeFinal = pronto.convertido ? `${nome.replace(/\.[^.]+$/, '')}.webp` : nome;
  const { data: p, error } = await client.rpc('preparar_ficheiro_empresa', {
    empresa, p_contexto: contexto, p_ref: ref, p_nome: nomeFinal, p_mime: pronto.mime, p_tamanho: pronto.bytes.byteLength,
  });
  if (error || !p?.caminho) return { erro: `${nome}: não foi possível registar` };
  const { error: semFicheiro } = await client.storage.from(BUCKET_FICHEIROS).upload(p.caminho, pronto.bytes, { contentType: pronto.mime, upsert: false });
  if (semFicheiro) {
    await client.rpc('apagar_ficheiro_empresa', { ficheiro: p.id });
    return { erro: `${nome}: o envio falhou` };
  }
  const { error: semFim } = await client.rpc('concluir_ficheiro_empresa', { ficheiro: p.id });
  if (semFim) return { erro: `${nome}: o envio não ficou concluído` };
  return { ok: true as const, id: p.id as string, nome: nomeFinal };
}

export function ficheirosDoForm(form: FormData, campo = 'ficheiros') {
  return form.getAll(campo).filter((f): f is File => f instanceof File && f.size > 0);
}

/** O logótipo: até 600×240, WebP. Aceita PNG, JPEG, WebP e SVG. */
export async function prepararLogotipo(ficheiro: File) {
  if (ficheiro.size > 5 * 1024 * 1024) return { erro: 'O logótipo tem mais de 5 MB.' };
  const bytes = Buffer.from(await ficheiro.arrayBuffer());
  const svg = /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.subarray(0, 300).toString('utf8'));
  if (!svg && !tipoReal(new Uint8Array(bytes))?.startsWith('image/')) return { erro: 'O logótipo tem de ser PNG, JPEG, WebP ou SVG.' };
  try {
    const webp = await sharp(bytes, { density: svg ? 300 : undefined })
      .rotate()
      .resize({ width: 600, height: 240, fit: 'inside', withoutEnlargement: !svg })
      .webp({ quality: 88, alphaQuality: 100 })
      .toBuffer();
    if (webp.byteLength > 500 * 1024) return { erro: 'O logótipo continua grande demais depois de otimizado.' };
    return { ok: true as const, bytes: new Uint8Array(webp) };
  } catch {
    return { erro: 'Não foi possível ler a imagem do logótipo.' };
  }
}

/** O logótipo da empresa em PNG, para os PDF e o Excel. Nulo se não houver. */
export async function logotipoPng(client: SupabaseClient, caminho: string | null) {
  if (!caminho) return null;
  try {
    const { data } = await client.storage.from(BUCKET_LOGOTIPOS).download(caminho);
    if (!data) return null;
    const png = await sharp(Buffer.from(await data.arrayBuffer())).png().toBuffer({ resolveWithObject: true });
    return { bytes: new Uint8Array(png.data), largura: png.info.width, altura: png.info.height };
  } catch {
    return null;
  }
}
