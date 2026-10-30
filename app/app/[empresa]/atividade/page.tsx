import { empresaDaSessao } from '@/lib/auth';
import { data, dataHora } from '@/lib/formato';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atividade' };

const TIPOS: Record<string, string> = {
  data_corte: 'Data de corte', documento: 'Documento enviado', documento_atrasado: 'Documento fora do prazo',
  documento_eliminado: 'Documento apagado', documento_devolvido: 'Documento devolvido', mes_completo: 'Mês entregue',
  mes_conferido: 'Mês conferido', balancete: 'Balancete consultado', balancete_pdf: 'Balancete em PDF',
  balancete_xlsx: 'Balancete em Excel', extrato: 'Extrato consultado', saldos: 'Saldos consultados',
  clientes: 'Clientes consultados', fornecedores: 'Fornecedores consultados', bancos: 'Bancos consultados',
  extrato_pdf: 'Extrato em PDF', extrato_xlsx: 'Extrato em Excel', comprovativo: 'Comprovativo de entrega',
  ficha: 'Dados da empresa', logotipo: 'Logótipo', definicoes: 'Definições do contabilista', pessoal: 'Pessoal',
  recibos: 'Recibos de vencimento', imposto: 'Impostos', descarga: 'Descarga',
};

export default async function Atividade({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  const [{ data: registos }, { data: cortes }] = await Promise.all([
    client.from('empresa_atividade').select('id,tipo,detalhe,criado_em').eq('company_id', empresa.id).order('criado_em', { ascending: false }).limit(300),
    client.from('empresa_cortes').select('id,data_corte,nota,definido_em').eq('company_id', empresa.id).order('definido_em', { ascending: false }).limit(50),
  ]);
  return (
    <div className={p.colunas}>
      <section className={p.cartao}>
        <div className={p.cabecalho}><h2>Registo de atividade</h2><p>Os últimos 300 registos</p></div>
        {registos?.length ? (
          <div className={p.envolveTabela}>
            <table className={p.tabela}>
              <thead><tr><th scope="col">Quando</th><th scope="col">O quê</th><th scope="col">Detalhe</th></tr></thead>
              <tbody>
                {registos.map((r) => (
                  <tr key={r.id}><td className={p.num}>{dataHora(r.criado_em)}</td><td>{TIPOS[r.tipo] ?? r.tipo}</td><td>{r.detalhe}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pequeno suave">Ainda sem atividade.</p>}
      </section>
      <section className={p.cartao}>
        <h2>Histórico da data de corte</h2>
        {cortes?.length ? (
          <ul className={p.lista}>
            {cortes.map((c) => (
              <li key={c.id}><div><strong>{c.data_corte ? `Fechada até ${data(c.data_corte)}` : 'Data de corte retirada'}</strong>{c.nota && <small>{c.nota}</small>}</div><time>{dataHora(c.definido_em)}</time></li>
            ))}
          </ul>
        ) : <p className="pequeno suave">A data de corte ainda não foi definida.</p>}
        <p className="pequeno suave">Cada balancete descarregado leva uma referência que aparece neste registo, com a data, a hora e quem o tirou.</p>
      </section>
    </div>
  );
}
