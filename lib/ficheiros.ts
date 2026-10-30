import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { tipoReal } from './tipos-ficheiro';

/* O logótipo da empresa e os buckets das secções novas. Os envios de
   ficheiros (pessoal, comprovativos) estão em envios.ts: vão do browser
   diretamente para o Storage. */

export const BUCKET_FICHEIROS = 'empresas-ficheiros';
export const BUCKET_LOGOTIPOS = 'empresas-logotipos';

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
