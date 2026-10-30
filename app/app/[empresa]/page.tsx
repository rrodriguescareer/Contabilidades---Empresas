import Link from 'next/link';
import { Suspense } from 'react';
import { empresaDaSessao, type EmpresaDoPortal } from '@/lib/auth';
import { obterBalancete } from '@/lib/contabilidade';
import { indicadores } from '@/lib/contas';
import { ultimoMesFechado } from '@/lib/corte';
import { data, dataHora, dataLonga, euros, maiuscula, mesAno } from '@/lib/formato';
import { estadoDoMes, type Mes } from '@/lib/meses';
import { Indisponivel } from '@/components/indisponivel';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visão geral' };

type ImpostoAberto = { id: string; tipo: string; periodo: string; valor: number | null; prazo: string | null; atrasado: boolean };
type Resumo = {
  empresa: { id: string; nome: string; data_corte: string | null; data_corte_em: string | null; tem_cegid: boolean };
  hoje: string;
  mes_em_curso: string;
  meses: Mes[];
  mensagens_por_ler: number;
  ultima_mensagem: { corpo: string; em: string; do_gabinete: boolean } | null;
  prazos: { id: string; titulo: string; data: string; descricao: string | null; geral: boolean }[];
  atividade: { tipo: string; detalhe: string | null; em: string }[];
  impostos: ImpostoAberto[];
};

export default async function VisaoGeral({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const { data: bruto, error } = await client.rpc('empresa_resumo', { empresa: empresa.id });
  if (error || !bruto) {
    return <p className="aviso aviso-critico" role="alert">Não foi possível carregar a visão geral. Tente novamente.</p>;
  }
  const r = bruto as Resumo;
  const emCurso = r.meses.find((m) => m.mes === r.mes_em_curso) ?? r.meses[0];
  const prazo = new Date(Date.parse(emCurso.prazo) - 1000); // o fim do dia 10
  const dias = Math.ceil((Date.parse(emCurso.prazo) - Date.now()) / 86400000);
  const estado = estadoDoMes(emCurso);

  return (
    <>
      <section className={`${p.cartao} ${p.destaque}`}>
        <span className={p.rotulo}>Documentos de {mesAno(emCurso.mes)}</span>
        <h2>
          {estado.estado === 'conferido' ? 'Mês entregue e conferido.'
            : estado.estado === 'completo' ? 'Mês entregue. Obrigado.'
            : dias > 0 ? `Tem até ${dataLonga(prazo.toISOString().slice(0, 10))} — ${dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}.`
            : 'O prazo deste mês já terminou.'}
        </h2>
        <p>
          {emCurso.documentos === 0
            ? 'Ainda não enviou documentos deste mês: faturas de venda e de compra, extratos bancários, recibos e o que mais houver.'
            : `${emCurso.documentos} ${emCurso.documentos === 1 ? 'documento enviado' : 'documentos enviados'}${emCurso.atrasados ? `, ${emCurso.atrasados} fora do prazo` : ''}${emCurso.devolvidos ? `; ${emCurso.devolvidos} devolvido${emCurso.devolvidos === 1 ? '' : 's'} para corrigir` : ''}.`}
        </p>
        <div className={p.acoes}>
          <Link className="btn" href={`${base}/documentos?mes=${emCurso.mes.slice(0, 7)}`}>Enviar documentos</Link>
          {empresa.data_corte && <Link className="btn btn-secundario" href={`${base}/balancete`}>Tirar balancete</Link>}
        </div>
      </section>

      <Suspense fallback={<div className={p.numeros}>{[0, 1, 2, 3].map((i) => <span key={i} className="esqueleto" style={{ minBlockSize: '6rem' }} />)}</div>}>
        <Indicadores empresa={empresa} base={base} />
      </Suspense>

      <div className={p.colunas}>
        <div className={p.pilha}>
          <section className={p.cartao}>
            <div className={p.cabecalho}>
              <h2>Os últimos meses</h2>
              <p>Prazo: dia 10 do mês seguinte</p>
            </div>
            <ul className={p.meses}>
              {r.meses.map((m) => {
                const e = estadoDoMes(m);
                return (
                  <li key={m.mes}>
                    <Link className={p.mes} data-estado={e.estado} href={`${base}/documentos?mes=${m.mes.slice(0, 7)}`}>
                      <strong>{maiuscula(mesAno(m.mes))}</strong>
                      <span>{m.documentos} {m.documentos === 1 ? 'documento' : 'documentos'}</span>
                      <span>{e.texto}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={p.cartao}>
            <div className={p.cabecalho}>
              <h2>Data de corte</h2>
              {r.empresa.data_corte_em && <p>Definida em {dataHora(r.empresa.data_corte_em)}</p>}
            </div>
            {empresa.data_corte ? (
              <p>
                A contabilidade está revista até <strong>{dataLonga(empresa.data_corte)}</strong>. Os saldos e os
                balancetes que tirar daqui vão até essa data — nunca para além dela —, por isso pode entregá-los a um
                banco ou a um parceiro com segurança.
              </p>
            ) : (
              <p className="suave">
                O contabilista ainda não definiu a data de corte desta empresa. Até lá, os saldos e balancetes não estão
                disponíveis; os documentos do mês e as mensagens já funcionam.
              </p>
            )}
          </section>
        </div>

        <div className={p.pilha}>
          {r.impostos.length > 0 && (
            <section className={p.cartao}>
              <div className={p.cabecalho}><h2>Impostos por pagar</h2><Link className="pequeno" href={`${base}/impostos`}>Ver todos</Link></div>
              <ul className={p.lista}>
                {r.impostos.map((i) => (
                  <li key={i.id}>
                    <div><strong>{i.tipo} · {i.periodo}</strong><small>{i.valor != null ? euros(Number(i.valor)) : 'Valor por indicar'}</small></div>
                    <time style={i.atrasado ? { color: 'var(--critico)', fontWeight: 700 } : undefined}>{i.prazo ? `${i.atrasado ? 'Atrasado · ' : 'até '}${data(i.prazo)}` : '—'}</time>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={p.cartao}>
            <div className={p.cabecalho}>
              <h2>Mensagens</h2>
              {r.mensagens_por_ler > 0 && <span className="etiqueta etiqueta-acao">{r.mensagens_por_ler} por ler</span>}
            </div>
            {r.ultima_mensagem ? (
              <p className="pequeno">
                <strong>{r.ultima_mensagem.do_gabinete ? 'Contabilista' : 'Empresa'}</strong> · {dataHora(r.ultima_mensagem.em)}
                <br />
                <span className="suave">{r.ultima_mensagem.corpo}</span>
              </p>
            ) : (
              <p className="pequeno suave">Ainda sem mensagens. Escreva sempre que tiver uma dúvida.</p>
            )}
            <Link className="btn btn-secundario btn-sm" href={`${base}/mensagens`}>Abrir mensagens</Link>
          </section>

          <section className={p.cartao}>
            <div className={p.cabecalho}><h2>Próximos prazos</h2><Link className="pequeno" href={`${base}/prazos`}>Ver todos</Link></div>
            {r.prazos.length ? (
              <ul className={p.lista}>
                {r.prazos.map((x) => (
                  <li key={x.id}><div><strong>{x.titulo}</strong>{x.descricao && <small>{x.descricao}</small>}</div><time>{data(x.data)}</time></li>
                ))}
              </ul>
            ) : (
              <p className="pequeno suave">Sem prazos marcados pelo contabilista. O dos documentos é sempre o dia 10.</p>
            )}
          </section>

          <section className={p.cartao}>
            <div className={p.cabecalho}><h2>Atividade recente</h2><Link className="pequeno" href={`${base}/atividade`}>Ver tudo</Link></div>
            {r.atividade.length ? (
              <ul className={p.lista}>
                {r.atividade.map((a, i) => (
                  <li key={i}><div><strong>{a.detalhe || a.tipo}</strong></div><time>{dataHora(a.em)}</time></li>
                ))}
              </ul>
            ) : (
              <p className="pequeno suave">Ainda sem atividade.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/** Os números do último mês fechado, do Cegid. Chegam depois do resto da
    página, para o início nunca ficar à espera do Cegid. */
async function Indicadores({ empresa, base }: { empresa: EmpresaDoPortal; base: string }) {
  const limite = ultimoMesFechado(empresa.data_corte);
  if (!limite) return null;
  const b = await obterBalancete(empresa, limite.ano, limite.mes);
  if (!b.ok) return <Indisponivel erro={b.erro} motivo={b.motivo} base={base} />;
  const n = indicadores(b.dados.linhas);
  const quando = `no fim de ${mesAno(b.dados.fim)}`;
  return (
    <div className={p.numeros}>
      <Link className={p.numero} href={`${base}/bancos`}><span>Bancos e caixa {quando}</span><strong>{euros(n.disponivel)}</strong></Link>
      <Link className={p.numero} href={`${base}/clientes`}><span>A receber de clientes</span><strong>{euros(n.clientes)}</strong></Link>
      <Link className={p.numero} href={`${base}/fornecedores`}><span>A pagar a fornecedores</span><strong>{euros(n.fornecedores)}</strong></Link>
      <Link className={p.numero} href={`${base}/balancete`}><span>Resultado de {limite.ano} até {mesAno(b.dados.fim).split(' de ')[0]}</span><strong>{euros(n.resultado)}</strong></Link>
    </div>
  );
}
