import { NextResponse } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';
import { BUCKET_LOGOTIPOS } from '@/lib/ficheiros';

export const dynamic = 'force-dynamic';

/** O logótipo da empresa, servido com a sessão de quem pede. O endereço muda
    com cada logótipo novo (?v=), por isso pode ficar em cache no browser. */
export async function GET(_: Request, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  if (!empresa.logotipo) return new NextResponse(null, { status: 404 });
  const { data } = await client.storage.from(BUCKET_LOGOTIPOS).download(empresa.logotipo);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(await data.arrayBuffer()), {
    headers: { 'Content-Type': data.type || 'image/webp', 'Cache-Control': 'private, max-age=604800, immutable' },
  });
}
