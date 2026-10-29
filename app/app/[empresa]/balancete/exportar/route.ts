import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { empresaDaSessao } from '@/lib/auth';
import { obterBalancete, registarExtracao } from '@/lib/contabilidade';
import { aoNivel, NIVEIS } from '@/lib/contas';
import { mesesPermitidos, ultimoMesFechado } from '@/lib/corte';
import { balancetePdf, balanceteXlsx } from '@/lib/exportar';
import { MESES } from '@/lib/formato';

export const dynamic = 'force-dynamic';

/* O balancete para descarregar. Volta a aplicar a data de corte do lado do
   servidor: os parâmetros do endereço nunca a alargam. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { user, empresa } = await empresaDaSessao(id);
  const q = request.nextUrl.searchParams;
  const formato = q.get('formato') === 'xlsx' ? 'xlsx' : 'pdf';
  const limite = ultimoMesFechado(empresa.data_corte);
  const voltar = new URL(`/app/${empresa.id}/balancete`, request.url);
  if (!limite) return NextResponse.redirect(voltar);

  const ano = Number(q.get('ano')) || limite.ano;
  const ate = Math.min(Number(q.get('ate')) || 12, mesesPermitidos(ano, empresa.data_corte));
  const nivel = NIVEIS.find((n) => n.valor === q.get('nivel')) ?? NIVEIS[0];
  const b = await obterBalancete(empresa.id, empresa.data_corte, ano, ate);
  if (!b.ok) {
    voltar.searchParams.set('ano', String(ano));
    return NextResponse.redirect(voltar);
  }

  const referencia = randomBytes(4).toString('hex').toUpperCase();
  const cabecalho = {
    empresa: empresa.nome, nif: empresa.nif, ano, ate: b.dados.ate, corte: b.dados.corte,
    exercicio: b.dados.exercicio, detalhe: nivel.nome, extraido_por: user.email,
    extraido_em: new Date().toISOString(), referencia,
  };
  const linhas = aoNivel(b.dados.linhas, Number(nivel.valor));
  const corpo = formato === 'pdf'
    ? await balancetePdf(cabecalho, linhas, b.dados.linhas)
    : balanceteXlsx(cabecalho, linhas, b.dados.linhas);

  await registarExtracao(empresa.id, user.id, `balancete_${formato}`,
    `Balancete ${formato === 'pdf' ? 'PDF' : 'Excel'} de janeiro a ${MESES[b.dados.ate - 1]} de ${ano}, data de corte ${b.dados.corte} (ref. ${referencia})`);

  const nome = `balancete-${empresa.nif}-${ano}-${String(b.dados.ate).padStart(2, '0')}-corte-${b.dados.corte}.${formato}`;
  return new NextResponse(Buffer.from(corpo), {
    headers: {
      'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
