import { tipoReal } from './tipos-ficheiro';

/* Do lado do browser: preparar cada ficheiro e carregá-lo para o endereço
 * assinado do Storage, com o progresso.
 *
 * As fotografias de telemóvel (4000px, vários MB) passam a WebP, até 2600px —
 * o texto de um recibo continua nítido — antes de saírem do telemóvel: o envio
 * é mais rápido e o armazenamento não enche. Onde o browser não codifica WebP,
 * passam a JPEG. Os PDF seguem como estão. */

const MEDIDA = 2600;
export const MAXIMO = 10 * 1024 * 1024;

export type Pronto = { blob: Blob; nome: string; mime: string; original: number };

const comExtensao = (nome: string, mime: string) =>
  `${nome.replace(/\.[^.]+$/, '') || 'documento'}.${mime === 'image/webp' ? 'webp' : 'jpg'}`;

const paraBlob = (tela: HTMLCanvasElement, tipo: string, qualidade: number) =>
  new Promise<Blob | null>((r) => tela.toBlob(r, tipo, qualidade));

async function comprimir(f: File): Promise<Blob | null> {
  const imagem = await createImageBitmap(f, { imageOrientation: 'from-image' });
  const escala = Math.min(1, MEDIDA / Math.max(imagem.width, imagem.height));
  const tela = document.createElement('canvas');
  tela.width = Math.max(1, Math.round(imagem.width * escala));
  tela.height = Math.max(1, Math.round(imagem.height * escala));
  const ctx = tela.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
  imagem.close();
  const webp = await paraBlob(tela, 'image/webp', 0.82);
  if (webp?.type === 'image/webp') return webp;
  // Sem WebP: JPEG, com as transparências a branco.
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  const jpeg = await paraBlob(tela, 'image/jpeg', 0.85);
  return jpeg?.type === 'image/jpeg' ? jpeg : null;
}

/** O ficheiro pronto a enviar, ou o motivo por que não pode seguir. */
export async function preparar(f: File): Promise<Pronto | { erro: string }> {
  const mime = tipoReal(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
  if (!mime) return { erro: 'só se aceitam PDF, JPEG, PNG ou WebP' };
  if (mime === 'image/jpeg' || mime === 'image/png') {
    const menor = await comprimir(f).catch(() => null);
    if (menor && menor.size < f.size && menor.size <= MAXIMO) return { blob: menor, nome: comExtensao(f.name, menor.type), mime: menor.type, original: f.size };
  }
  if (f.size > MAXIMO) return { erro: mime === 'application/pdf' ? 'o PDF tem mais de 10 MB' : 'tem mais de 10 MB' };
  return { blob: f, nome: f.name || 'documento', mime, original: f.size };
}

/** Carrega para o endereço assinado. O progresso vai de 0 a 1. */
export function carregar(url: string, p: Pronto, progresso: (fracao: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', p.mime);
    x.setRequestHeader('x-upsert', 'false');
    x.setRequestHeader('cache-control', 'max-age=3600');
    x.upload.onprogress = (e) => { if (e.lengthComputable) progresso(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Estado ${x.status}`)));
    x.onerror = () => reject(new Error('Sem ligação'));
    x.ontimeout = () => reject(new Error('Demorou demasiado'));
    x.timeout = 10 * 60 * 1000;
    x.send(p.blob);
  });
}
