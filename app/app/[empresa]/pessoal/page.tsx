import Link from 'next/link';
import { empresaDaSessao } from '@/lib/auth';
import { data, dataHora, maiuscula, mesAno } from '@/lib/formato';
import { ESTADOS_PESSOAL, rotuloPessoal, TIPOS_PESSOAL } from '@/lib/pessoal';
import { FormPessoal } from '@/components/form-pessoal';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pessoal' };

type Pedido = { id: string; tipo: string; trabalhador: string; dados: Record<string, string>; estado: string; resposta: string | null; criado_em: string };
type Ficheiro = { id: string; ref_id: string; nome: string; contexto: string };

export default async function Pessoal({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const [{ empresa: id }, pedido] = await Promise.all([params, searchParams]);
  const { client, empresa } = await empresaDaSessao(id);
  await client.rpc('marcar_visto', { p_area: `empresas:pessoal:${empresa.id}` });
  const base = `/app/${empresa.id}`;
  if (!empresa.tem_trabalhadores) {
    return (
      <div className="vazio">
        <strong>Esta empresa não tem trabalhadores registados</strong>
        <p>Se passou a ter, marque-o em Dados da empresa, ou peça ao contabilista. A secção de pessoal fica logo disponível.</p>
        <Link className="btn btn-secundario" href={`${base}/dados`}>Abrir os dados da empresa</Link>
      </div>
    );
  }
  const tipo = TIPOS_PESSOAL[pedido.tipo || ''] ? pedido.tipo! : 'admissao';
  const def = TIPOS_PESSOAL[tipo];
  const [{ data: pedidos }, { data: recibos }, { data: ficheiros }] = await Promise.all([
    client.from('empresa_pessoal').select('id,tipo,trabalhador,dados,estado,resposta,criado_em').eq('company_id', empresa.id)
      .order('criado_em', { ascending: false }).limit(60),
    client.from('empresa_recibos').select('id,mes,publicado_em').eq('company_id', empresa.id).not('publicado_em', 'is', null)
      .order('mes', { ascending: false }).limit(24),
    client.from('empresa_ficheiros').select('id,ref_id,nome,contexto').eq('company_id', empresa.id).in('contexto', ['pessoal', 'recibos'])
      .eq('estado', 'carregado'),
  ]);
  const anexos = (ref: string) => ((ficheiros ?? []) as Ficheiro[]).filter((f) => f.ref_id === ref);

  return (
    <div className={p.colunas}>
      <div className={p.pilha}>
        <section className={p.cartao}>
          <div className={p.cabecalho}><h2>Comunicar ao contabilista</h2></div>
          <nav className={p.abas} aria-label="Tipo de comunicação">
            {Object.entries(TIPOS_PESSOAL).map(([k, t]) => (
              <Link key={k} className={p.aba} aria-current={k === tipo} href={`${base}/pessoal?tipo=${k}`}>{t.titulo}</Link>
            ))}
          </nav>
          <p className="aviso">{def.nota}</p>
          <FormPessoal key={tipo} empresa={empresa.id} comunicacao={tipo} botao={`Enviar ${def.titulo.toLowerCase()}`} documentos={def.documentos}>
            <div className={p.linhaCampos}>
              {def.campos.map((c) => (
                <label key={c.nome} className="campo" style={c.tipo === 'area' ? { gridColumn: '1 / -1' } : undefined}>
                  <span>{c.rotulo}{c.obrigatorio ? ' *' : ''}</span>
                  {c.tipo === 'escolha' ? (
                    <select name={c.nome} className="entrada" required={c.obrigatorio} defaultValue="">
                      <option value="">—</option>
                      {c.opcoes!.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.tipo === 'area' ? (
                    <textarea name={c.nome} className="entrada" rows={3} maxLength={1500} required={c.obrigatorio} />
                  ) : (
                    <input name={c.nome} className="entrada" required={c.obrigatorio} maxLength={200}
                           type={c.tipo === 'data' ? 'date' : 'text'} inputMode={c.tipo === 'numero' ? 'decimal' : undefined} />
                  )}
                  {c.ajuda && <small>{c.ajuda}</small>}
                </label>
              ))}
            </div>
          </FormPessoal>
        </section>

        <section className={p.cartao}>
          <div className={p.cabecalho}><h2>Comunicações enviadas</h2><p>As últimas 60</p></div>
          {pedidos?.length ? (
            <ul className={p.documentos}>
              {(pedidos as Pedido[]).map((x) => (
                <li key={x.id}>
                  <div className={p.nome}>
                    <strong className="pequeno">{TIPOS_PESSOAL[x.tipo]?.titulo ?? x.tipo}: {x.trabalhador}</strong>
                    <small>
                      {dataHora(x.criado_em)} · {Object.entries(x.dados).slice(0, 4).map(([k, v]) => `${rotuloPessoal(x.tipo, k)}: ${/^\d{4}-\d{2}-\d{2}$/.test(v) ? data(v) : v}`).join(' · ')}
                    </small>
                    {anexos(x.id).map((f) => <a key={f.id} href={`${base}/ficheiros/${f.id}`} target="_blank" rel="noopener"><small>📎 {f.nome}</small></a>)}
                  </div>
                  <div className={p.estado}><span className={ESTADOS_PESSOAL[x.estado]?.classe}>{ESTADOS_PESSOAL[x.estado]?.texto ?? x.estado}</span></div>
                  {x.resposta && <p className={x.estado === 'devolvido' ? p.resposta : 'pequeno suave'} style={{ gridColumn: '1 / -1', margin: 0 }}>Contabilista: {x.resposta}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="pequeno suave">Ainda sem comunicações.</p>}
        </section>
      </div>

      <section className={p.cartao}>
        <div className={p.cabecalho}><h2>Recibos de vencimento</h2><p>Um PDF por mês, publicado pelo contabilista</p></div>
        {recibos?.length ? (
          <ul className={p.lista}>
            {recibos.map((r) => (
              <li key={r.id}>
                <div><strong>{maiuscula(mesAno(r.mes))}</strong><small>Publicado a {dataHora(r.publicado_em)}</small></div>
                <span className="linha">
                  {anexos(r.id).map((f) => <a key={f.id} className="btn btn-secundario btn-sm" href={`${base}/ficheiros/${f.id}?descarregar=1`}>Descarregar</a>)}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="pequeno suave">Ainda não há recibos publicados.</p>}
      </section>
    </div>
  );
}
