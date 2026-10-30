import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { obterBalancete, registarExtracao } from '@/lib/contabilidade';
import { contasDeMovimento } from '@/lib/contas';
import { ultimoMesFechado } from '@/lib/corte';
import { data, dataHora, mesAno, valor } from '@/lib/formato';
import { Icone } from '@/components/icones';
import { Indisponivel } from '@/components/indisponivel';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contas e saldos' };

const CLASSES: Record<string, string> = {
  '1': 'Meios financeiros líquidos', '2': 'Contas a receber e a pagar', '3': 'Inventários', '4': 'Investimentos',
  '5': 'Capital e reservas', '6': 'Gastos', '7': 'Rendimentos', '8': 'Resultados',
};

export default async function Contas({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ classe?: string; q?: string }> }) {
  const [{ empresa: id }, pedido] = await Promise.all([params, searchParams]);
  const { user, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const limite = ultimoMesFechado(empresa.data_corte);
  if (!limite) return <Indisponivel base={base} motivo="corte" erro="O contabilista ainda não definiu a data de corte desta empresa." />;
  const b = await obterBalancete(empresa, limite.ano, limite.mes);
  if (!b.ok) return <Indisponivel base={base} erro={b.erro} motivo={b.motivo} />;
  await registarExtracao(empresa.id, user.id, 'saldos', `Saldos das contas consultados (fim de ${mesAno(b.dados.fim)})`);

  const classe = CLASSES[pedido.classe || ''] ? pedido.classe! : '';
  const termo = (pedido.q || '').trim().toLowerCase();
  const contas = contasDeMovimento(b.dados.linhas)
    .filter((l) => !classe || l.conta.startsWith(classe))
    .filter((l) => !termo || l.descricao.toLowerCase().includes(termo) || l.conta.startsWith(termo));
  const presentes = new Set(b.dados.linhas.map((l) => l.conta.slice(0, 1)));

  return (
    <section className={p.cartao}>
      <div className={p.cabecalho}>
        <div><h2>Saldos no fim de {mesAno(b.dados.fim)}</h2><p>Contas de movimento do plano SNC</p></div>
        <form className={p.filtros} method="get">
          {classe && <input type="hidden" name="classe" value={classe} />}
          <input type="search" name="q" defaultValue={pedido.q} className="entrada" placeholder="Procurar por nome ou conta" aria-label="Procurar" />
        </form>
      </div>
      <nav className={p.fichas} aria-label="Classes">
        <Link className={p.ficha} aria-current={!classe} href={`${base}/contas`}>Todas</Link>
        {Object.entries(CLASSES).filter(([k]) => presentes.has(k)).map(([k, nome]) => (
          <Link key={k} className={p.ficha} aria-current={classe === k} href={`${base}/contas?classe=${k}`}>{k} · {nome}</Link>
        ))}
      </nav>
      <p className={p.carimbo}>
        <Icone nome="cadeado" tamanho={16} />
        <span>Saldos a <strong>{data(b.dados.fim)}</strong> — último mês fechado até à data de corte ({data(b.dados.corte)}).</span>
      </p>
      {contas.length === 0 ? (
        <p className="vazio">Nenhuma conta corresponde.</p>
      ) : (
        <div className={p.envolveTabela}>
          <table className={p.tabela}>
            <thead>
              <tr><th scope="col">Conta</th><th scope="col">Descrição</th><th scope="col" className={p.num}>Saldo devedor</th><th scope="col" className={p.num}>Saldo credor</th></tr>
            </thead>
            <tbody>
              {contas.map((l) => (
                <tr key={l.conta}>
                  <td className={p.conta}><Link href={`${base}/extrato?conta=${l.conta}&ano=${b.dados.ano}`}>{l.conta}</Link></td>
                  <td>{l.descricao}</td>
                  <td className={p.num}>{l.saldo > 0.005 ? valor(l.saldo) : ''}</td>
                  <td className={`${p.num} ${p.credor}`}>{l.saldo < -0.005 ? valor(-l.saldo) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={p.rodapeTabela}><span>Obtido do Cegid Business em {dataHora(b.dados.obtido_em)}.</span><span>Clique numa conta para ver os movimentos.</span></div>
    </section>
  );
}
