import sharp from 'sharp';

/* Os documentos fiscais são quase todos fotografias de telemóvel: 4000px de
 * largura e vários megabytes para um recibo que se lê a 1600px. Guardar o
 * original enche o armazenamento sem acrescentar nada ao que se consegue ler.
 *
 * As imagens passam a WebP, redimensionadas até caber numa medida que mantém
 * o texto nítido. Os PDF ficam como estão: já vêm comprimidos, e reescrevê-los
 * arrisca estragar assinaturas digitais.
 */

/** Chega para ler um recibo ou uma declaração sem perder o detalhe fino. */
const MEDIDA_MAXIMA = 2600;
const QUALIDADE = 82;

export type Comprimido = {
  bytes: Uint8Array;
  mime: string;
  /** Extensão a usar no nome guardado, sem ponto. */
  extensao: string;
  convertido: boolean;
};

export async function comprimirDocumento(bytes: Uint8Array, mime: string): Promise<Comprimido> {
  if (mime !== 'image/jpeg' && mime !== 'image/png') {
    return { bytes, mime, extensao: 'pdf', convertido: false };
  }

  try {
    const imagem = sharp(bytes, { failOn: 'none' }).rotate(); // respeita a orientação do EXIF
    const { width = 0, height = 0 } = await imagem.metadata();
    const maior = Math.max(width, height);

    const resultado = await imagem
      .resize(
        maior > MEDIDA_MAXIMA
          ? { width: width >= height ? MEDIDA_MAXIMA : undefined, height: height > width ? MEDIDA_MAXIMA : undefined, fit: 'inside', withoutEnlargement: true }
          : undefined,
      )
      .webp({ quality: QUALIDADE, effort: 5 })
      .toBuffer();

    // Se o original já era mais pequeno, não vale a pena trocar.
    if (resultado.byteLength >= bytes.byteLength) {
      return { bytes, mime, extensao: mime === 'image/png' ? 'png' : 'jpg', convertido: false };
    }

    return { bytes: new Uint8Array(resultado), mime: 'image/webp', extensao: 'webp', convertido: true };
  } catch {
    // Imagem que o sharp não consegue ler: guarda-se como veio.
    return { bytes, mime, extensao: mime === 'image/png' ? 'png' : 'jpg', convertido: false };
  }
}

/** Troca a extensão do nome original pela do ficheiro guardado. */
export function nomeGuardado(original: string, extensao: string) {
  const base = original.replace(/\.[^.]+$/, '') || 'documento';
  return `${base.slice(0, 200)}.${extensao}`;
}
