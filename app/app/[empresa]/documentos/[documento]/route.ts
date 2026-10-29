import { NextResponse, type NextRequest } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Abre um documento enviado: um endereço assinado de um minuto, pedido com a
    sessão de quem o abre, para a política do Storage decidir. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ empresa: string; documento: string }> }) {
  const { empresa: id, documento } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  const { data: doc } = await client.from('empresa_documentos').select('caminho,nome').eq('id', documento).eq('company_id', empresa.id).maybeSingle();
  if (!doc) return new NextResponse('Documento indisponível.', { status: 404 });
  const descarregar = request.nextUrl.searchParams.has('descarregar');
  const { data, error } = await client.storage.from('empresas-documentos')
    .createSignedUrl(doc.caminho, 60, descarregar ? { download: doc.nome } : undefined);
  if (error || !data?.signedUrl) return new NextResponse('Não foi possível abrir o documento.', { status: 502 });
  const r = NextResponse.redirect(data.signedUrl);
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}
