import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';
import { nomeDaCategoria } from '@/lib/categorias';
import { registarExtracao } from '@/lib/contabilidade';
import { relatorioPdf } from '@/lib/exportar';
import { logotipoPng } from '@/lib/ficheiros';
import { dataHora, dataLonga, mesAno, tamanho } from '@/lib/formato';
import { prazoDoMes } from '@/lib/meses';

export const dynamic = 'force-dynamic';

const ESTADOS: Record<string, string> = { recebido: 'Recebido', visto: 'Visto pelo contabilista', devolvido: 'Devolvido' };

/** O comprovativo de entrega dos documentos de um mês: o que foi enviado,
    quando, e se chegou dentro do prazo. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, user, empresa } = await empresaDaSessao(id);
  const mes = request.nextUrl.searchParams.get('mes') || '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return new NextResponse('Mês inválido.', { status: 400 });
  const [{ data: docs }, { data: estado }] = await Promise.all([
    client.from('empresa_documentos').select('nome,categoria,tamanho,estado,atrasado,enviado_em')
      .eq('company_id', empresa.id).eq('mes', `${mes}-01`).neq('estado', 'pendente').order('enviado_em'),
    client.from('empresa_meses').select('completo_em,conferido_em,fechado_em').eq('company_id', empresa.id).eq('mes', `${mes}-01`).maybeSingle(),
  ]);
  const lista = docs ?? [];
  const referencia = randomBytes(4).toString('hex').toUpperCase();
  const atrasados = lista.filter((d) => d.atrasado).length;
  const pdf = await relatorioPdf({
    titulo: `Comprovativo de entrega — documentos de ${mesAno(`${mes}-01`)}`,
    empresa: empresa.nome, nif: empresa.nif,
    logotipo: await logotipoPng(client, empresa.logotipo),
    carimbo: {
      titulo: `${lista.length} DOCUMENTO${lista.length === 1 ? '' : 'S'}`,
      texto: `Prazo: ${dataLonga(prazoDoMes(mes))}. ${atrasados ? `${atrasados} entregue(s) fora do prazo.` : 'Todos entregues dentro do prazo.'}`
        + (estado?.conferido_em ? ` Conferido pelo contabilista a ${dataHora(estado.conferido_em)}.` : ''),
    },
    meta: [
      estado?.completo_em ? `Dado como completo a ${dataHora(estado.completo_em)}` : 'Ainda não dado como completo',
      `Emitido em ${dataHora(new Date().toISOString())} por ${user.email}`, `Referência: ${referencia}`,
    ],
    colunas: [
      { titulo: 'Enviado em', largura: 95 }, { titulo: 'Documento', largura: 320 }, { titulo: 'Tipo', largura: 110 },
      { titulo: 'Tamanho', largura: 60 }, { titulo: 'Estado', largura: 115 }, { titulo: 'Prazo', largura: 70 },
    ],
    linhas: lista.map((d) => ({
      valores: [dataHora(d.enviado_em), d.nome, nomeDaCategoria(d.categoria), tamanho(d.tamanho), ESTADOS[d.estado] ?? d.estado, d.atrasado ? 'Fora do prazo' : 'No prazo'],
    })),
    rodape: `Documentos de ${mesAno(`${mes}-01`)}`,
  });
  await registarExtracao(empresa.id, user.id, 'comprovativo', `Comprovativo de entrega de ${mesAno(`${mes}-01`)} (ref. ${referencia})`);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="comprovativo-entrega-${empresa.nif}-${mes}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
