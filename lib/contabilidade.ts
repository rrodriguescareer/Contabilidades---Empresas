import 'server-only';
import { headers } from 'next/headers';
import { adminClient, adminConfigured } from './admin-client';
import { balanceteDoCegid, extratoDoCegid, type LinhaBalancete, type Movimento, type Resultado } from './cegid';
import { periodoDoBalancete, periodoDoExtrato, semDepoisDoCorte } from './corte';

/* O que o portal mostra da contabilidade: sempre do Cegid, sempre limitado
   pela data de corte, e guardado durante umas horas. O que está antes do corte
   já foi revisto e não muda; e a chave da cache inclui a data de corte, por
   isso mudá-la na Gestão invalida tudo (a base também apaga a cache). */

const VALIDADE_MS = 6 * 60 * 60 * 1000;

async function daCache<T>(empresa: string, chave: string, obter: () => Promise<Resultado<T>>, renovar = false) {
  if (!adminConfigured()) return { ...(await obter()), obtido_em: new Date().toISOString() };
  const admin = adminClient();
  if (!renovar) {
    const { data } = await admin.from('empresa_cegid_cache').select('dados,obtido_em')
      .eq('company_id', empresa).eq('chave', chave).maybeSingle();
    if (data && Date.now() - Date.parse(data.obtido_em) < VALIDADE_MS) {
      return { ok: true as const, dados: data.dados as T, obtido_em: data.obtido_em as string };
    }
  }
  const novo = await obter();
  const agora = new Date().toISOString();
  if (novo.ok) {
    await admin.from('empresa_cegid_cache')
      .upsert({ company_id: empresa, chave, dados: novo.dados, obtido_em: agora })
      .then(({ error }) => error && console.error(JSON.stringify({ event: 'rr_cache_cegid', erro: error.message })));
  }
  return { ...novo, obtido_em: agora };
}

export type Balancete = {
  ano: number; de: number; ate: number; fim: string; corte: string;
  exercicio: string; linhas: LinhaBalancete[]; obtido_em: string;
};

export type Indisponivel = { ok: false; erro: string; motivo: string };

export async function obterBalancete(empresa: string, corte: string | null, ano: number, ate: number, renovar = false): Promise<{ ok: true; dados: Balancete } | Indisponivel> {
  if (!corte) return { ok: false, motivo: 'corte', erro: 'O contabilista ainda não definiu a data de corte desta empresa.' };
  const periodo = periodoDoBalancete(ano, ate, corte);
  if (!periodo) return { ok: false, motivo: 'corte', erro: `Ainda não há meses de ${ano} fechados até à data de corte.` };
  const r = await daCache(empresa, `balancete:${ano}:${periodo.ate}:${corte}`, () => balanceteDoCegid(empresa, ano, periodo.ate), renovar);
  if (!r.ok) return r;
  return { ok: true, dados: { ...periodo, corte, exercicio: r.dados.exercicio, linhas: r.dados.linhas, obtido_em: r.obtido_em } };
}

export type Extrato = {
  ano: number; inicio: string; fim: string; corte: string; conta: string; descricao: string;
  movimentos: Movimento[]; obtido_em: string;
};

export async function obterExtrato(empresa: string, corte: string | null, ano: number, conta: string): Promise<{ ok: true; dados: Extrato } | Indisponivel> {
  if (!corte) return { ok: false, motivo: 'corte', erro: 'O contabilista ainda não definiu a data de corte desta empresa.' };
  if (!/^\d{1,15}$/.test(conta)) return { ok: false, motivo: 'pedido', erro: 'Conta inválida.' };
  const periodo = periodoDoExtrato(ano, corte);
  if (!periodo) return { ok: false, motivo: 'corte', erro: `O ano de ${ano} é posterior à data de corte.` };
  const r = await daCache(empresa, `extrato:${ano}:${conta}:${periodo.fim}`,
    () => extratoDoCegid(empresa, ano, conta, periodo.inicio, periodo.fim));
  if (!r.ok) return r;
  return {
    ok: true,
    dados: {
      ano, ...periodo, corte, conta, descricao: r.dados.descricao,
      movimentos: semDepoisDoCorte(r.dados.movimentos, corte), obtido_em: r.obtido_em,
    },
  };
}

/** Prova do que foi extraído e quando: entra no registo de atividade da
    empresa, com a origem. Nunca faz falhar a extração. */
export async function registarExtracao(empresa: string, utilizador: string, tipo: string, detalhe: string) {
  if (!adminConfigured()) return;
  try {
    const h = await headers();
    const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null;
    const { error } = await adminClient().from('empresa_atividade').insert({
      company_id: empresa, user_id: utilizador, tipo, detalhe: detalhe.slice(0, 2000),
      ip, agente: (h.get('user-agent') || '').slice(0, 400) || null,
    });
    if (error) throw error;
  } catch (falha) {
    console.error(JSON.stringify({ event: 'rr_registo_empresa', tipo, erro: String((falha as Error)?.message || falha) }));
  }
}
