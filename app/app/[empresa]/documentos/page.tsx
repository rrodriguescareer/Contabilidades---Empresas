import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { eliminarDocumento, marcarMes } from '@/lib/acoes';
import { CATEGORIAS } from '@/lib/categorias';
import { dataHora, dataLonga, maiuscula, mesAno, tamanho } from '@/lib/formato';
import { mesAtualEmLisboa, mesesParaEnviar, prazoDoMes } from '@/lib/meses';
import { Avisos } from '@/components/avisos';
import { EnviarDocumentos } from '@/components/enviar-documentos';
import { Submeter } from '@/components/forms';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documentos do mês' };

type Documento = {
  id: string; categoria: string; nome: string; mime: string; tamanho: number; tamanho_original: number | null;
  estado: string; atrasado: boolean; resposta: string | null; nota: string | null; enviado_por: string; enviado_em: string;
  revisto_em: string | null;
};

const ESTADOS: Record<string, { texto: string; classe: string }> = {
  recebido: { texto: 'Recebido', classe: 'etiqueta' },
  visto: { texto: 'Visto pelo contabilista', classe: 'etiqueta etiqueta-positivo' },
  devolvido: { texto: 'Devolvido', classe: 'etiqueta etiqueta-critico' },
};

export default async function Documentos({ params, searchParams }: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ mes?: string; erro?: string; mensagem?: string }>;
}) {
  const [{ empresa: id }, pedido] = await Promise.all([params, searchParams]);
  const { client, user, empresa } = await empresaDaSessao(id);
  await client.rpc('marcar_visto', { p_area: `empresas:documentos:${empresa.id}` });
  const base = `/app/${empresa.id}`;

  const atual = mesAtualEmLisboa();
  // Nada antes do início do acompanhamento.
  const inicio = empresa.inicio?.slice(0, 7);
  const meses = mesesParaEnviar(atual).filter((m) => !inicio || m >= inicio);
  if (!meses.length) {
    return <p className="vazio">O acompanhamento desta empresa começa em {mesAno(`${inicio}-01`)}. Os documentos desse mês podem ser enviados a partir dele.</p>;
  }
  const diaHoje = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', day: '2-digit' }).format(new Date()));
  const emCurso = (diaHoje <= 10 && meses[1]) || meses[0];
  const mes = meses.includes(pedido.mes || '') ? pedido.mes! : emCurso;
  const prazo = prazoDoMes(mes);
  const foraDoPrazo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date()) > prazo;

  const [{ data: documentos }, { data: estadoMes }] = await Promise.all([
    client.from('empresa_documentos')
      .select('id,categoria,nome,mime,tamanho,tamanho_original,estado,atrasado,resposta,nota,enviado_por,enviado_em,revisto_em')
      .eq('company_id', empresa.id).eq('mes', `${mes}-01`).neq('estado', 'pendente')
      .order('enviado_em', { ascending: false }),
    client.from('empresa_meses').select('completo_em,conferido_em,nota,bloqueado,fechado_em').eq('company_id', empresa.id).eq('mes', `${mes}-01`).maybeSingle(),
  ]);
  const lista = (documentos ?? []) as Documento[];
  const fechado = Boolean(estadoMes?.fechado_em || estadoMes?.bloqueado);
  const poupado = lista.reduce((t, d) => t + Math.max(0, (d.tamanho_original ?? d.tamanho) - d.tamanho), 0);
  // Os devolvidos que ainda não têm, depois deles, outro documento do mesmo tipo.
  const devolvidos = lista.filter((d) => d.estado === 'devolvido'
    && !lista.some((x) => x.categoria === d.categoria && x.estado !== 'devolvido' && d.revisto_em && x.enviado_em > d.revisto_em));

  return (
    <>
      <Avisos erro={pedido.erro} mensagem={pedido.mensagem} />
      <nav className={p.fichas} aria-label="Mês dos documentos">
        {meses.map((m) => (
          <Link key={m} className={p.ficha} aria-current={m === mes} href={`${base}/documentos?mes=${m}`}>{maiuscula(mesAno(`${m}-01`))}</Link>
        ))}
      </nav>

      <div className={p.colunas}>
        <div className={p.pilha}>
          <section className={p.cartao}>
            <div className={p.cabecalho}>
              <div>
                <h2>Enviar documentos de {mesAno(`${mes}-01`)}</h2>
                <p>{foraDoPrazo ? `O prazo terminou a ${dataLonga(prazo)}.` : `Prazo: até ${dataLonga(prazo)}.`}</p>
              </div>
              {estadoMes?.fechado_em ? <span className="etiqueta etiqueta-positivo">Informação completa</span>
                : estadoMes?.bloqueado ? <span className="etiqueta etiqueta-critico">Envio bloqueado</span>
                : estadoMes?.conferido_em ? <span className="etiqueta etiqueta-positivo">Conferido</span>
                : estadoMes?.completo_em ? <span className="etiqueta etiqueta-acao">Dado como completo</span>
                : foraDoPrazo ? <span className="etiqueta etiqueta-atencao">Prazo terminado</span>
                : <span className="etiqueta">Em aberto</span>}
            </div>
            {fechado ? (
              <p className="aviso">
                {estadoMes?.fechado_em
                  ? `O contabilista fechou este mês a ${dataHora(estadoMes.fechado_em)}: a informação está completa e não é preciso enviar mais nada.`
                  : 'O contabilista bloqueou o envio de documentos para este mês. Se precisar de enviar alguma coisa, fale com ele nas mensagens.'}
              </p>
            ) : (
              <>
                {devolvidos.length > 0 && (
                  <div className={p.devolvidos} role="note">
                    <strong>{devolvidos.length === 1 ? 'Um documento foi devolvido' : `${devolvidos.length} documentos foram devolvidos`}: envie a versão corrigida aqui.</strong>
                    <ul>{devolvidos.map((d) => <li key={d.id}>{d.nome}{d.resposta ? ` — ${d.resposta}` : ''}</li>)}</ul>
                  </div>
                )}
                <EnviarDocumentos key={mes} empresa={empresa.id} mes={mes} foraDoPrazo={foraDoPrazo} categoriaInicial={devolvidos[0]?.categoria ?? ''} />
              </>
            )}
          </section>

          <section className={p.cartao}>
            <div className={p.cabecalho}>
              <h2>Enviados ({lista.length})</h2>
              <div className={p.acoes}>
                {poupado > 0 && <p>Imagens otimizadas: menos {tamanho(poupado)} guardados.</p>}
                {lista.length > 0 && <a className="btn btn-secundario btn-sm" href={`${base}/documentos/comprovativo?mes=${mes}`}>Comprovativo de entrega (PDF)</a>}
              </div>
            </div>
            {lista.length === 0 ? (
              <p className="pequeno suave">Ainda não há documentos deste mês.</p>
            ) : (
              CATEGORIAS.filter((c) => lista.some((d) => d.categoria === c.valor)).map((c) => (
                <div key={c.valor} className="pilha pilha-2">
                  <h3>{c.nome}</h3>
                  <ul className={p.documentos}>
                    {lista.filter((d) => d.categoria === c.valor).map((d) => (
                      <li key={d.id}>
                        <div className={p.nome}>
                          <a href={`${base}/documentos/${d.id}`} target="_blank" rel="noopener">{d.nome}</a>
                          <small>{tamanho(d.tamanho)} · {dataHora(d.enviado_em)}{d.nota ? ` · ${d.nota}` : ''}</small>
                        </div>
                        <div className={p.estado}>
                          {d.atrasado && <span className="etiqueta etiqueta-atencao">Fora do prazo</span>}
                          <span className={ESTADOS[d.estado]?.classe ?? 'etiqueta'}>{ESTADOS[d.estado]?.texto ?? d.estado}</span>
                          {d.estado === 'recebido' && d.enviado_por === user.id && !fechado && (
                            <form action={eliminarDocumento}>
                              <input type="hidden" name="empresa" value={empresa.id} />
                              <input type="hidden" name="documento" value={d.id} />
                              <input type="hidden" name="mes" value={mes} />
                              <Submeter className="btn-texto" aDecorrer="…">Apagar</Submeter>
                            </form>
                          )}
                        </div>
                        {d.estado === 'devolvido' && d.resposta && <p className={p.resposta}>{d.resposta}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>

        <div className={p.pilha}>
          <section className={p.cartao}>
            <h2>Terminou o mês?</h2>
            {fechado ? (
              <p className="pequeno">{estadoMes?.fechado_em ? 'Mês fechado pelo contabilista: informação completa.' : 'Envio bloqueado pelo contabilista.'}</p>
            ) : estadoMes?.conferido_em ? (
              <p className="pequeno">O contabilista conferiu os documentos deste mês a {dataHora(estadoMes.conferido_em)}.{estadoMes.nota ? ` Nota: ${estadoMes.nota}` : ''}</p>
            ) : estadoMes?.completo_em ? (
              <>
                <p className="pequeno">Indicou a {dataHora(estadoMes.completo_em)} que já enviou tudo. O contabilista vai conferir.</p>
                <form action={marcarMes}>
                  <input type="hidden" name="empresa" value={empresa.id} /><input type="hidden" name="mes" value={mes} /><input type="hidden" name="completo" value="false" />
                  <Submeter className="btn btn-secundario btn-sm" aDecorrer="…">Afinal ainda falta enviar</Submeter>
                </form>
              </>
            ) : (
              <>
                <p className="pequeno suave">Quando tiver enviado todos os documentos de {mesAno(`${mes}-01`)}, avise o contabilista com um clique.</p>
                <form action={marcarMes}>
                  <input type="hidden" name="empresa" value={empresa.id} /><input type="hidden" name="mes" value={mes} /><input type="hidden" name="completo" value="true" />
                  <Submeter className="btn btn-secundario btn-sm" aDecorrer="…">Já enviei tudo deste mês</Submeter>
                </form>
              </>
            )}
          </section>
          <section className={p.cartao}>
            <h2>O que enviar</h2>
            <ul className={p.lista}>
              {CATEGORIAS.map((c) => <li key={c.valor}><div><strong>{c.nome}</strong><small>{c.nota}</small></div></li>)}
            </ul>
            <p className="pequeno suave">Os documentos de cada mês entregam-se até ao dia 10 do mês seguinte. Os que chegam depois ficam marcados como fora do prazo.</p>
          </section>
        </div>
      </div>
    </>
  );
}
