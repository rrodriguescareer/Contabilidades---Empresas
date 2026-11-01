import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { obterBalancete, registarExtracao } from '@/lib/contabilidade';
import { contasDaSecao, SECOES_DE_CONTAS, type SecaoDeContas } from '@/lib/contas';
import { ultimoMesFechado } from '@/lib/corte';
import { data, dataHora, euros, mesAno, valor } from '@/lib/formato';
import { Icone } from './icones';
import { Indisponivel } from './indisponivel';
import p from './paginas.module.css';

/** Clientes, fornecedores ou bancos: as contas de movimento do grupo, com o
    saldo no último mês fechado e a ligação ao extrato de cada uma. */
export async function ListaContas({ id, secao, procura }: { id: string; secao: SecaoDeContas; procura?: string }) {
  const { user, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const cfg = SECOES_DE_CONTAS[secao];
  const limite = ultimoMesFechado(empresa.data_corte);
  if (!limite) return <Indisponivel base={base} motivo="corte" erro="O contabilista ainda não definiu a data de corte desta empresa." />;
  const b = await obterBalancete(empresa, limite.ano, limite.mes);
  if (!b.ok) return <Indisponivel base={base} erro={b.erro} motivo={b.motivo} />;
  await registarExtracao(empresa.id, user.id, secao, `${cfg.titulo}: saldos consultados (fim de ${mesAno(b.dados.fim)})`);

  const termo = (procura || '').trim().toLowerCase();
  const todas = contasDaSecao(b.dados.linhas, secao).filter((l) => Math.abs(l.saldo) > 0.005 || l.debito || l.credito);
  const contas = termo ? todas.filter((l) => l.descricao.toLowerCase().includes(termo) || l.conta.startsWith(termo)) : todas;
  const total = todas.reduce((t, l) => t + l.saldo * cfg.sinal, 0);
  const ordenadas = [...contas].sort((a, z) => Math.abs(z.saldo) - Math.abs(a.saldo));

  return (
    <>
      <div className={p.numeros}>
        <div className={p.numero}><span>{cfg.positivo} no fim de {mesAno(b.dados.fim)}</span><strong>{euros(total)}</strong></div>
        <div className={p.numero}><span>Contas com movimento em {b.dados.ano}</span><strong>{todas.length}</strong></div>
      </div>

      <section className={p.cartao}>
        <div className={p.cabecalho}>
          <h2>{cfg.titulo}</h2>
          <form className={p.filtros} method="get">
            <input type="search" name="q" defaultValue={procura} className="entrada" placeholder="Procurar por nome ou conta" aria-label="Procurar" />
          </form>
        </div>
        <p className={p.carimbo}>
          <Icone nome="cadeado" tamanho={16} />
          <span>Saldos a <strong>{data(b.dados.fim)}</strong>, o último mês fechado até à data de corte ({data(b.dados.corte)}).</span>
        </p>
        {ordenadas.length === 0 ? (
          <p className="vazio">{termo ? 'Nenhuma conta corresponde à procura.' : 'Sem contas com movimento neste grupo.'}</p>
        ) : (
          <div className={p.envolveTabela}>
            <table className={p.tabela}>
              <thead>
                <tr>
                  <th scope="col">Conta</th><th scope="col">Nome</th>
                  <th scope="col" className={`${p.num} ${p.mov}`}>Débito</th><th scope="col" className={`${p.num} ${p.mov}`}>Crédito</th>
                  <th scope="col" className={p.num}>Saldo</th><th scope="col"><span className="so-leitor">Histórico</span></th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((l) => {
                  const s = l.saldo * cfg.sinal;
                  return (
                    <tr key={l.conta}>
                      <td className={p.conta}>{l.conta}</td>
                      <td>{l.descricao}</td>
                      <td className={`${p.num} ${p.mov}`}>{valor(l.debito)}</td>
                      <td className={`${p.num} ${p.mov}`}>{valor(l.credito)}</td>
                      <td className={`${p.num} ${s < -0.005 ? p.credor : ''}`} title={s < -0.005 ? cfg.negativo : cfg.positivo}>{valor(s)}</td>
                      <td><Link prefetch={false} href={`${base}/extrato?conta=${l.conta}&ano=${b.dados.ano}`}>Histórico</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={p.rodapeTabela}>
          <span>Obtido do Cegid Business em {dataHora(b.dados.obtido_em)}.</span>
          <span>Valores negativos: {cfg.negativo.toLowerCase()}.</span>
        </div>
      </section>
    </>
  );
}
