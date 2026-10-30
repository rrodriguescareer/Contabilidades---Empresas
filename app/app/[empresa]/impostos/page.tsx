import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { marcarImpostoPago } from '@/lib/acoes-empresa';
import { data, dataHora, euros } from '@/lib/formato';
import { situacao, TIPOS_IMPOSTO, type Imposto } from '@/lib/impostos';
import { Avisos } from '@/components/avisos';
import { Comprovativo } from '@/components/comprovativo';
import { Submeter } from '@/components/forms';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Impostos' };

type Ficheiro = { id: string; ref_id: string; nome: string; contexto: string };

export default async function Impostos({ params, searchParams }: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<{ tipo?: string; mensagem?: string; erro?: string }>;
}) {
  const [{ empresa: id }, pedido] = await Promise.all([params, searchParams]);
  const { client, empresa } = await empresaDaSessao(id);
  const base = `/app/${empresa.id}`;
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  const [{ data: todos }, { data: ficheiros }] = await Promise.all([
    client.from('empresa_impostos').select('id,tipo,periodo,descricao,referencia,valor,prazo,estado,pago_em,criado_em')
      .eq('company_id', empresa.id).order('prazo', { ascending: false, nullsFirst: false }).limit(300),
    client.from('empresa_ficheiros').select('id,ref_id,nome,contexto').eq('company_id', empresa.id)
      .in('contexto', ['guia', 'comprovativo']).eq('estado', 'carregado'),
  ]);
  const lista = (todos ?? []) as Imposto[];
  const porPagar = lista.filter((i) => i.estado !== 'pago');
  const tipo = pedido.tipo && (TIPOS_IMPOSTO[pedido.tipo] || pedido.tipo === 'por_pagar') ? pedido.tipo
    : porPagar.length ? 'por_pagar' : 'IVA';
  const mostrar = (tipo === 'por_pagar' ? porPagar : lista.filter((i) => i.tipo === tipo))
    .sort((a, b) => (situacao(a, hoje) === 'pago' ? 1 : 0) - (situacao(b, hoje) === 'pago' ? 1 : 0) || String(a.prazo).localeCompare(String(b.prazo)));
  const total = porPagar.reduce((t, i) => t + Number(i.valor || 0), 0);
  const atrasados = porPagar.filter((i) => i.prazo && i.prazo < hoje).length;
  const anexos = (ref: string, contexto: string) => ((ficheiros ?? []) as Ficheiro[]).filter((f) => f.ref_id === ref && f.contexto === contexto);

  return (
    <>
      <Avisos erro={pedido.erro} mensagem={pedido.mensagem} />
      <div className={p.numeros}>
        <div className={p.numero}><span>Por pagar</span><strong>{euros(total)}</strong></div>
        <div className={p.numero}><span>Pagamentos em aberto</span><strong>{porPagar.length}</strong></div>
        <div className={p.numero}><span>Com o prazo ultrapassado</span><strong>{atrasados}</strong></div>
      </div>
      <nav className={p.abas} aria-label="Tipo de imposto">
        <Link className={p.aba} aria-current={tipo === 'por_pagar'} href={`${base}/impostos?tipo=por_pagar`}>Por pagar{porPagar.length ? <span>{porPagar.length}</span> : null}</Link>
        {Object.entries(TIPOS_IMPOSTO).map(([k, nome]) => {
          const n = porPagar.filter((i) => i.tipo === k).length;
          return <Link key={k} className={p.aba} aria-current={k === tipo} href={`${base}/impostos?tipo=${k}`}>{nome}{n ? <span>{n}</span> : null}</Link>;
        })}
      </nav>
      {mostrar.length === 0 ? (
        <p className="vazio">{tipo === 'por_pagar' ? 'Não há nada por pagar. Quando o contabilista publicar uma guia, aparece aqui e recebe um email.' : 'Sem períodos deste imposto.'}</p>
      ) : (
        <ul className={p.impostos}>
          {mostrar.map((i) => {
            const s = situacao(i, hoje);
            const guias = anexos(i.id, 'guia');
            const provas = anexos(i.id, 'comprovativo');
            return (
              <li key={i.id} className={p.imposto} data-estado={s}>
                <div>
                  <h3>{TIPOS_IMPOSTO[i.tipo] ?? i.tipo} · {i.periodo}</h3>
                  {i.descricao && <p>{i.descricao}</p>}
                  {i.referencia && <p>Referência: <span className={p.referencia}>{i.referencia}</span></p>}
                  <p>
                    {s === 'pago' ? `Pago${i.pago_em ? ` a ${dataHora(i.pago_em)}` : ''}`
                      : i.prazo ? `${s === 'atraso' ? 'Prazo ultrapassado' : 'Pagar até'} ${data(i.prazo)}` : 'Sem prazo indicado'}
                  </p>
                </div>
                <div className={p.valor}>
                  {i.valor != null ? euros(Number(i.valor)) : '—'}
                  <small>
                    <span className={s === 'pago' ? 'etiqueta etiqueta-positivo' : s === 'atraso' ? 'etiqueta etiqueta-critico' : 'etiqueta etiqueta-atencao'}>
                      {s === 'pago' ? 'Pago' : s === 'atraso' ? 'Em atraso' : 'Por pagar'}
                    </span>
                  </small>
                </div>
                <div className={p.impostoAcoes}>
                  {guias.map((f) => <a key={f.id} className="btn btn-sm" href={`${base}/ficheiros/${f.id}?descarregar=1`}>Guia: {f.nome}</a>)}
                  {provas.map((f) => <a key={f.id} className="btn btn-discreto btn-sm" href={`${base}/ficheiros/${f.id}`} target="_blank" rel="noopener">Comprovativo: {f.nome}</a>)}
                  <form action={marcarImpostoPago}>
                    <input type="hidden" name="empresa" value={empresa.id} /><input type="hidden" name="imposto" value={i.id} />
                    <input type="hidden" name="tipo" value={tipo} /><input type="hidden" name="pago" value={s === 'pago' ? 'false' : 'true'} />
                    <Submeter className="btn btn-secundario btn-sm" aDecorrer="…">{s === 'pago' ? 'Afinal não está pago' : 'Marcar como pago'}</Submeter>
                  </form>
                  {s !== 'pago' || !provas.length ? <Comprovativo empresa={empresa.id} imposto={i.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
