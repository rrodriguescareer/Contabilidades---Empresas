import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { obterExtrato, registarExtracao } from '@/lib/contabilidade';
import { anosDisponiveis, ultimoMesFechado } from '@/lib/corte';
import { data, dataHora, valor } from '@/lib/formato';
import { Icone } from '@/components/icones';
import { Imprimir } from '@/components/imprimir';
import { Indisponivel } from '@/components/indisponivel';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Extrato de conta' };

export default async function Extrato({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ conta?: string; ano?: string }> }) {
  const [{ empresa: id }, pedido] = await Promise.all([params, searchParams]);
  const { user, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const limite = ultimoMesFechado(empresa.data_corte);
  const conta = (pedido.conta || '').trim();
  if (!limite || !empresa.data_corte) return <Indisponivel base={base} motivo="corte" erro="O contabilista ainda não definiu a data de corte desta empresa." />;
  if (!/^\d{1,15}$/.test(conta)) {
    return <p className="aviso">Escolha uma conta em <Link href={`${base}/contas`}>Contas e saldos</Link>, Clientes, Fornecedores ou Bancos.</p>;
  }
  const anos = [...new Set([Number(empresa.data_corte.slice(0, 4)), ...anosDisponiveis(empresa.data_corte)])].sort((a, b) => b - a);
  const ano = anos.includes(Number(pedido.ano)) ? Number(pedido.ano) : anos[0];
  const r = await obterExtrato(empresa, ano, conta);
  if (r.ok) await registarExtracao(empresa.id, user.id, 'extrato', `Extrato da conta ${conta} de ${ano}, até ${r.dados.fim}`);

  let acumulado = 0;
  return (
    <>
      <form className={p.filtros} method="get">
        <input type="hidden" name="conta" value={conta} />
        <label>Ano
          <select name="ano" defaultValue={ano} className="entrada">{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <button className="btn btn-secundario" type="submit">Ver</button>
      </form>
      {!r.ok ? (
        <Indisponivel base={base} erro={r.erro} motivo={r.motivo} />
      ) : (
        <section className={p.cartao}>
          <div className={p.cabecalho}>
            <div><h2>Conta {r.dados.conta}{r.dados.descricao ? ` · ${r.dados.descricao}` : ''}</h2><p>De {data(r.dados.inicio)} a {data(r.dados.fim)}</p></div>
            <div className={p.acoes}>
              <a className="btn btn-sm" href={`${base}/extrato/exportar?formato=pdf&conta=${conta}&ano=${ano}`}><Icone nome="descarregar" tamanho={16} /> PDF</a>
              <a className="btn btn-secundario btn-sm" href={`${base}/extrato/exportar?formato=xlsx&conta=${conta}&ano=${ano}`}><Icone nome="descarregar" tamanho={16} /> Excel</a>
              <Imprimir className="btn btn-discreto btn-sm naoImprimir" />
            </div>
          </div>
          <p className={p.carimbo}>
            <Icone nome="cadeado" tamanho={16} />
            <span>Movimentos até à data de corte, <strong>{data(r.dados.corte)}</strong>. Os posteriores ainda não foram revistos e não são mostrados.</span>
          </p>
          {r.dados.movimentos.length === 0 ? (
            <p className="vazio">Sem movimentos neste período.</p>
          ) : (
            <div className={p.envolveTabela}>
              <table className={p.tabela}>
                <thead>
                  <tr>
                    <th scope="col">Data</th><th scope="col">Documento</th><th scope="col">Descrição</th>
                    <th scope="col" className={p.num}>Débito</th><th scope="col" className={p.num}>Crédito</th><th scope="col" className={p.num}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {r.dados.movimentos.map((m, i) => {
                    acumulado += m.debito - m.credito;
                    return (
                      <tr key={i} data-inicial={m.inicial}>
                        <td className={p.num}>{m.data ? data(m.data) : ''}</td>
                        <td>{m.documento || ''}</td>
                        <td>{m.descricao}{m.terceiro && <><br /><small className="suave">{m.terceiro}{m.nif ? ` · NIF ${m.nif}` : ''}</small></>}</td>
                        <td className={p.num}>{m.debito ? valor(m.debito) : ''}</td>
                        <td className={p.num}>{m.credito ? valor(m.credito) : ''}</td>
                        <td className={`${p.num} ${acumulado < -0.005 ? p.credor : ''}`}>{valor(acumulado)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className={p.rodapeTabela}><span>Obtido do Cegid Business em {dataHora(r.dados.obtido_em)}.</span><span>Saldo: débitos menos créditos.</span></div>
        </section>
      )}
    </>
  );
}
