import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';
import { obterExtrato, registarExtracao } from '@/lib/contabilidade';
import { relatorioPdf, relatorioXlsx } from '@/lib/exportar';
import { logotipoPng } from '@/lib/ficheiros';
import { data, dataHora } from '@/lib/formato';

export const dynamic = 'force-dynamic';

/** O extrato de uma conta em PDF ou Excel, até à data de corte. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, user, empresa } = await empresaDaSessao(id);
  const q = request.nextUrl.searchParams;
  const formato = q.get('formato') === 'xlsx' ? 'xlsx' : 'pdf';
  const conta = q.get('conta') || '';
  const ano = Number(q.get('ano'));
  const r = await obterExtrato(empresa, ano, conta);
  if (!r.ok) return NextResponse.redirect(new URL(`/app/${empresa.id}/extrato?conta=${encodeURIComponent(conta)}&ano=${ano}`, request.url));
  const referencia = randomBytes(4).toString('hex').toUpperCase();
  let acumulado = 0;
  const relatorio = {
    titulo: `Extrato da conta ${r.dados.conta}${r.dados.descricao ? ` — ${r.dados.descricao}` : ''}`,
    empresa: empresa.nome, nif: empresa.nif, folha: 'Extrato',
    logotipo: await logotipoPng(client, empresa.logotipo),
    carimbo: { titulo: `DATA DE CORTE: ${data(r.dados.corte)}`, texto: 'Movimentos revistos pelo contabilista até esta data. Não inclui movimentos posteriores.' },
    meta: [`De ${data(r.dados.inicio)} a ${data(r.dados.fim)}`, `Extraído em ${dataHora(new Date().toISOString())} por ${user.email}`, `Referência: ${referencia}`],
    colunas: [
      { titulo: 'Data', largura: 62 }, { titulo: 'Documento', largura: 90 }, { titulo: 'Descrição', largura: 330 },
      { titulo: 'Débito', largura: 88, numero: true }, { titulo: 'Crédito', largura: 88, numero: true }, { titulo: 'Saldo', largura: 92, numero: true },
    ],
    linhas: r.dados.movimentos.map((m) => {
      acumulado += m.debito - m.credito;
      return {
        destaque: m.inicial,
        valores: [m.data ? data(m.data) : '', m.documento || '', [m.descricao, m.terceiro].filter(Boolean).join(' — '),
          m.debito || null, m.credito || null, acumulado],
      };
    }),
    rodape: `Data de corte ${data(r.dados.corte)}`,
  };
  const corpo = formato === 'pdf' ? await relatorioPdf(relatorio) : relatorioXlsx(relatorio);
  await registarExtracao(empresa.id, user.id, `extrato_${formato}`,
    `Extrato ${formato === 'pdf' ? 'PDF' : 'Excel'} da conta ${conta} de ${ano}, até ${r.dados.fim} (ref. ${referencia})`);
  return new NextResponse(Buffer.from(corpo), {
    headers: {
      'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="extrato-${empresa.nif}-${conta}-${ano}-corte-${r.dados.corte}.${formato}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
