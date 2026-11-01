import { empresaDaSessao } from '@/lib/auth';
import { MESES, maiuscula, mesAno } from '@/lib/formato';
import { mesAtualEmLisboa, mesesParaEnviar, prazoDoMes } from '@/lib/meses';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prazos' };

type Prazo = { id: string; titulo: string; descricao: string | null; data: string; tipo: 'documentos' | 'gabinete' | 'geral' };

export default async function Prazos({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, empresa } = await empresaDaSessao(id);
  await client.rpc('marcar_visto', { p_area: `empresas:prazos:${empresa.id}` });
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  const desde = new Date(Date.parse(hoje) - 45 * 86400000).toISOString().slice(0, 10);

  const { data } = await client.from('empresa_prazos').select('id,titulo,descricao,data,company_id')
    .gte('data', desde).order('data').limit(200);
  const marcados: Prazo[] = (data ?? [])
    .filter((x) => !x.company_id || x.company_id === empresa.id)
    .map((x) => ({ id: x.id, titulo: x.titulo, descricao: x.descricao, data: x.data, tipo: x.company_id ? 'gabinete' : 'geral' }));

  // O prazo dos documentos é sempre o dia 10: entra sozinho no calendário.
  const atual = mesAtualEmLisboa();
  const documentos: Prazo[] = mesesParaEnviar(atual, 3).map((m) => ({
    id: `docs-${m}`, tipo: 'documentos', data: prazoDoMes(m),
    titulo: `Documentos de ${mesAno(`${m}-01`)}`,
    descricao: 'Entrega no portal: faturas, extratos bancários e restantes documentos do mês.',
  }));
  const todos = [...marcados, ...documentos].filter((x) => x.data >= desde).sort((a, b) => a.data.localeCompare(b.data));
  const grupos = new Map<string, Prazo[]>();
  for (const x of todos) grupos.set(x.data.slice(0, 7), [...(grupos.get(x.data.slice(0, 7)) ?? []), x]);

  return (
    <div className={p.pilha} style={{ maxInlineSize: '56rem' }}>
      {[...grupos.entries()].map(([mes, lista]) => (
        <section key={mes} className={p.cartao}>
          <h2>{maiuscula(mesAno(`${mes}-01`))}</h2>
          <ul className={p.prazos}>
            {lista.map((x) => (
              <li key={x.id} className={p.prazo} data-passado={x.data < hoje} data-tipo={x.tipo}>
                <div className={p.dia}><strong>{Number(x.data.slice(8, 10))}</strong><span>{MESES[Number(x.data.slice(5, 7)) - 1].slice(0, 3)}</span></div>
                <div>
                  <h3>{x.titulo}</h3>
                  {x.descricao && <p>{x.descricao}</p>}
                  <p>{x.tipo === 'documentos' ? 'Prazo do portal' : x.tipo === 'gabinete' ? 'Marcado pelo contabilista para esta empresa' : 'Marcado pelo contabilista para todos os clientes'}{x.data < hoje ? ' · já passou' : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="pequeno suave">Os prazos fiscais da empresa (IVA, retenções, Segurança Social, declarações anuais) são marcados aqui pelo contabilista. Em caso de dúvida, pergunte nas mensagens.</p>
    </div>
  );
}
