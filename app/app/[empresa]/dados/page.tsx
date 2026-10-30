import { empresaDaSessao } from '@/lib/auth';
import { enviarLogotipo, guardarFicha, retirarLogotipo } from '@/lib/acoes-empresa';
import { CAMPOS, rotuloDoCampo, valorLegivel } from '@/lib/ficha';
import { dataHora } from '@/lib/formato';
import { Avisos } from '@/components/avisos';
import { FormAcao } from '@/components/form-acao';
import { Submeter } from '@/components/forms';
import { Marca } from '@/components/portal';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dados da empresa' };

const GRUPOS = ['Identificação', 'Fiscalidade', 'Morada', 'Segurança Social e banco', 'Contactos'] as const;

export default async function Dados({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ mensagem?: string; erro?: string }> }) {
  const [{ empresa: id }, aviso] = await Promise.all([params, searchParams]);
  const { client, empresa } = await empresaDaSessao(id);
  const [{ data: ficha }, { data: historico }] = await Promise.all([
    client.from('empresa_fichas').select('*').eq('company_id', empresa.id).maybeSingle(),
    client.from('empresa_ficha_historico').select('id,campo,antes,depois,origem,alterado_em').eq('company_id', empresa.id)
      .order('alterado_em', { ascending: false }).limit(100),
  ]);
  const valores: Record<string, unknown> = { ...(ficha ?? {}), nome: empresa.nome, nif: empresa.nif };

  return (
    <>
      <Avisos erro={aviso.erro} mensagem={aviso.mensagem} />
      <div className={p.colunas}>
        <section className={p.cartao}>
          <div className={p.cabecalho}>
            <h2>Ficha da empresa</h2>
            <p>O contabilista e a empresa podem atualizá-la. Cada alteração fica registada.</p>
          </div>
          <FormAcao acao={guardarFicha} botao="Guardar alterações" className={p.formulario}>
            <input type="hidden" name="empresa" value={empresa.id} />
            {GRUPOS.map((g) => (
              <fieldset key={g} className={p.grupo} style={{ border: 0, padding: 0 }}>
                <h3>{g}</h3>
                <div className={p.linhaCampos}>
                  {CAMPOS.filter((c) => c.grupo === g).map((c) => {
                    const v = valores[c.nome];
                    if (c.tipo === 'sim') {
                      return (
                        <label key={c.nome} className={p.marcar}>
                          <input type="checkbox" name={c.nome} defaultChecked={Boolean(v)} /> {c.rotulo}
                        </label>
                      );
                    }
                    return (
                      <label key={c.nome} className="campo" style={c.tipo === 'area' ? { gridColumn: '1 / -1' } : undefined}>
                        <span>{c.rotulo}{c.obrigatorio ? ' *' : ''}</span>
                        {c.tipo === 'escolha' ? (
                          <select name={c.nome} className="entrada" defaultValue={String(v ?? '')}>
                            <option value="">—</option>
                            {(Array.isArray(c.opcoes) ? c.opcoes.map((o) => [o, o]) : Object.entries(c.opcoes ?? {})).map(([valor, nome]) => (
                              <option key={valor} value={valor}>{nome}</option>
                            ))}
                          </select>
                        ) : c.tipo === 'area' ? (
                          <textarea name={c.nome} className="entrada" rows={3} maxLength={c.max} defaultValue={String(v ?? '')} />
                        ) : (
                          <input name={c.nome} className="entrada" maxLength={c.max} required={c.obrigatorio}
                                 type={c.tipo === 'email' ? 'email' : c.tipo === 'telefone' ? 'tel' : 'text'}
                                 inputMode={['nif', 'niss', 'cae'].includes(c.nome) ? 'numeric' : c.tipo === 'numero' ? 'decimal' : undefined}
                                 defaultValue={v == null ? '' : String(v)} />
                        )}
                        {c.ajuda && <small>{c.ajuda}</small>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </FormAcao>
        </section>

        <div className={p.pilha}>
          <section className={p.cartao}>
            <h2>Logótipo</h2>
            <div className="linha"><Marca empresa={empresa} tamanho="grande" /><p className="pequeno suave">Aparece no portal e nos documentos gerados: balancetes, extratos e comprovativos.</p></div>
            <FormAcao acao={enviarLogotipo} botao="Guardar logótipo" aDecorrer="A otimizar…" botaoClasse="btn btn-secundario btn-sm" className="pilha pilha-3">
              <input type="hidden" name="empresa" value={empresa.id} />
              <label className="campo">
                <span>Imagem (PNG, JPEG, WebP ou SVG)</span>
                <input type="file" name="logotipo" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />
                <small>É guardada em WebP, até 600×240, com fundo transparente se o tiver.</small>
              </label>
            </FormAcao>
            {empresa.logotipo && (
              <form action={retirarLogotipo}>
                <input type="hidden" name="empresa" value={empresa.id} />
                <Submeter className="btn-texto" aDecorrer="…">Retirar logótipo</Submeter>
              </form>
            )}
          </section>

          <section className={p.cartao}>
            <div className={p.cabecalho}><h2>Histórico de alterações</h2><p>As últimas 100</p></div>
            {historico?.length ? (
              <div className={p.envolveTabela}>
                <table className={`${p.tabela} ${p.historico}`}>
                  <thead><tr><th scope="col">Quando</th><th scope="col">Campo</th><th scope="col">Antes → depois</th></tr></thead>
                  <tbody>
                    {historico.map((h) => (
                      <tr key={h.id}>
                        <td>{dataHora(h.alterado_em)}<br /><span className="suave">{h.origem === 'gestao' ? 'Contabilista' : 'Empresa'}</span></td>
                        <td>{rotuloDoCampo(h.campo)}</td>
                        <td>{valorLegivel(h.campo, h.antes)} → <strong>{valorLegivel(h.campo, h.depois)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="pequeno suave">Ainda sem alterações registadas.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
