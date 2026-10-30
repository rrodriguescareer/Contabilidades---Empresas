import { NextResponse, type NextRequest } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';
import { BUCKET_FICHEIROS } from '@/lib/ficheiros';

export const dynamic = 'force-dynamic';

/** Abre um ficheiro das secções de pessoal e impostos (recibos, guias,
    comprovativos, documentos do pessoal) e regista a descarga. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ empresa: string; ficheiro: string }> }) {
  const { empresa: id, ficheiro } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  const { data: f } = await client.from('empresa_ficheiros').select('id,caminho,nome').eq('id', ficheiro).eq('company_id', empresa.id).maybeSingle();
  if (!f) return new NextResponse('Ficheiro indisponível.', { status: 404 });
  await client.rpc('registar_descarga_empresa', { ficheiro: f.id });
  const descarregar = request.nextUrl.searchParams.has('descarregar');
  const { data, error } = await client.storage.from(BUCKET_FICHEIROS).createSignedUrl(f.caminho, 60, descarregar ? { download: f.nome } : undefined);
  if (error || !data?.signedUrl) return new NextResponse('Não foi possível abrir o ficheiro.', { status: 502 });
  const r = NextResponse.redirect(data.signedUrl);
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}
