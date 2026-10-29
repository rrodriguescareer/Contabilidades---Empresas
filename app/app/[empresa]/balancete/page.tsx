import { empresaDaSessao } from '@/lib/auth';
import { obterBalancete, registarExtracao } from '@/lib/contabilidade';
import { aoNivel, NIVEIS } from '@/lib/contas';
import { anosDisponiveis, mesesPermitidos, ultimoMesFechado } from '@/lib/corte';
import { data, dataHora, dataLonga, MESES, maiuscula } from '@/lib/formato';
import { Icone } from '@/components/icones';
import { Indisponivel } from '@/components/indisponivel';
import { TabelaBalancete } from '@/components/tabela-balancete';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Balancete' };

export default async function Balancete({ params, searchParams }: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ ano?: string; ate?: string; nivel?: string }>;
}) {
  const { empresa: id } = await params;
  const pedido = await searchParams;
  const { user, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const limite = ultimoMesFechado(empresa.data_corte);
  if (!limite) {
    return <Indisponivel base={base} motivo="corte" erro="O contabilista ainda não definiu a data de corte desta empresa." />;
  }
  const anos = anosDisponiveis(empresa.data_corte);
  const ano = anos.includes(Number(pedido.ano)) ? Number(pedido.ano) : limite.ano;
  const maximo = mesesPermitidos(ano, empresa.data_corte);
  const ate = Math.min(Number(pedido.ate) || maximo, maximo);
  const nivel = ['2', '4', '0'].includes(pedido.nivel || '') ? pedido.nivel! : '2';

  const b = await obterBalancete(empresa.id, empresa.data_corte, ano, ate);
  if (b.ok) await registarExtracao(empresa.id, user.id, 'balancete', `Balancete consultado: janeiro a ${MESES[b.dados.ate - 1]} de ${ano}`);
  const consulta = `ano=${ano}&ate=${ate}&nivel=${nivel}`;

  return (
    <>
      <form className={p.filtros} method="get">
        <label>Ano
          <select name="ano" defaultValue={ano} className="entrada">{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <label>De janeiro até
          <select name="ate" defaultValue={ate} className="entrada">
            {Array.from({ length: ano === limite.ano ? limite.mes : 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{maiuscula(MESES[m - 1])}</option>
            ))}
          </select>
        </label>
        <label>Detalhe
          <select name="nivel" defaultValue={nivel} className="entrada">{NIVEIS.map((n) => <option key={n.valor} value={n.valor}>{n.nome}</option>)}</select>
        </label>
        <button className="btn btn-secundario" type="submit">Ver balancete</button>
      </form>

      {!b.ok ? (
        <Indisponivel base={base} erro={b.erro} motivo={b.motivo} />
      ) : (
        <section className={p.cartao}>
          <div className={p.cabecalho}>
            <div>
              <h2>Balancete de janeiro a {MESES[b.dados.ate - 1]} de {ano}</h2>
              <p>{b.dados.exercicio} · valores acumulados até {dataLonga(b.dados.fim)}</p>
            </div>
            <div className={p.acoes}>
              <a className="btn btn-sm" href={`${base}/balancete/exportar?formato=pdf&${consulta}`}><Icone nome="descarregar" tamanho={16} /> PDF</a>
              <a className="btn btn-secundario btn-sm" href={`${base}/balancete/exportar?formato=xlsx&${consulta}`}><Icone nome="descarregar" tamanho={16} /> Excel</a>
            </div>
          </div>
          <p className={p.carimbo}>
            <Icone nome="cadeado" tamanho={16} />
            <span>Data de corte: <strong>{data(b.dados.corte)}</strong></span>
            <span>Contabilidade revista pelo contabilista até esta data. Nada posterior está incluído.</span>
          </p>
          {b.dados.linhas.length === 0 ? (
            <p className="vazio">O Cegid não tem movimentos neste período.</p>
          ) : (
            <TabelaBalancete linhas={aoNivel(b.dados.linhas, Number(nivel))} todas={b.dados.linhas} base={base} ano={ano} />
          )}
          <div className={p.rodapeTabela}>
            <span>Obtido do Cegid Business em {dataHora(b.dados.obtido_em)}.</span>
            <span>Os totais somam as contas de movimento.</span>
          </div>
        </section>
      )}
    </>
  );
}
