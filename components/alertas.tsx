import type { SupabaseClient } from '@supabase/supabase-js';
import { lerAlerta } from '@/lib/acoes-empresa';
import { dataHora } from '@/lib/formato';
import { Submeter } from './forms';
import p from './paginas.module.css';

/** Os alertas do gabinete ainda por ler, por cima de cada ecrã da empresa. */
export async function Alertas({ client, empresa, utilizador }: { client: SupabaseClient; empresa: string; utilizador: string }) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  const [{ data: alertas }, { data: lidos }] = await Promise.all([
    client.from('empresa_alertas').select('id,titulo,corpo,nivel,criado_em,expira_em,company_id')
      .or(`company_id.eq.${empresa},company_id.is.null`).order('criado_em', { ascending: false }).limit(20),
    client.from('empresa_alertas_lidos').select('alerta_id').eq('user_id', utilizador),
  ]);
  const vistos = new Set((lidos ?? []).map((l) => l.alerta_id));
  const porLer = (alertas ?? []).filter((a) => !vistos.has(a.id) && (!a.expira_em || a.expira_em >= hoje));
  if (!porLer.length) return null;
  return (
    <div className={p.alertas} role="region" aria-label="Alertas do contabilista">
      {porLer.map((a) => (
        <div key={a.id} className={p.alerta} data-nivel={a.nivel}>
          <div>
            <strong>{a.titulo}</strong>
            {a.corpo && <p>{a.corpo}</p>}
            <small>Do contabilista · {dataHora(a.criado_em)}</small>
          </div>
          <form action={lerAlerta}>
            <input type="hidden" name="empresa" value={empresa} />
            <input type="hidden" name="alerta" value={a.id} />
            <Submeter className="btn btn-secundario btn-sm" aDecorrer="…">Marcar como lido</Submeter>
          </form>
        </div>
      ))}
    </div>
  );
}
