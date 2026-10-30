import 'server-only';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { adminClient, adminConfigured } from './admin-client';
import { balanceteDoCegid, extratoDoCegid, type Falha, type LinhaBalancete, type Movimento, type Resultado } from './cegid';
import { periodoDoBalancete, periodoDoExtrato, semDepoisDoCorte } from './corte';

/* O que o portal mostra da contabilidade: sempre do Cegid, sempre limitado
   pela data de corte, e guardado na cache de dados do Next (fora da base).
   O que está antes do corte já foi revisto e não muda, por isso a validade é
   longa. A chave leva a data de corte e a versão Cegid da empresa, que a
   Gestão sobe quando muda a data de corte ou as credenciais: uma chave nova
   é uma cache nova. As falhas nunca ficam guardadas. */

const VALIDADE_S = 30 * 24 * 60 * 60;

class FalhaCegid extends Error {
  constructor(readonly resultado: Falha) { super(resultado.erro); }
}

async function daCache<T>(empresa: string, versao: number, chave: string, obter: () => Promise<Resultado<T>>) {
  const guardado = unstable_cache(
    async () => {
      const r = await obter();
      if (!r.ok) throw new FalhaCegid(r);
      return { dados: r.dados, obtido_em: new Date().toISOString() };
    },
    ['cegid', empresa, String(versao), chave],
    { revalidate: VALIDADE_S, tags: [`cegid-${empresa}`] },
  );
  try {
    const v = await guardado();
    return { ok: true as const, dados: v.dados, obtido_em: v.obtido_em };
  } catch (e) {
    if (e instanceof FalhaCegid) return e.resultado;
    throw e;
  }
}

export type Balancete = {
  ano: number; de: number; ate: number; fim: string; corte: string;
  exercicio: string; linhas: LinhaBalancete[]; obtido_em: string;
};

export type Indisponivel = { ok: false; erro: string; motivo: string };
type Empresa = { id: string; data_corte: string | null; cegid_versao: number };

export async function obterBalancete(empresa: Empresa, ano: number, ate: number): Promise<{ ok: true; dados: Balancete } | Indisponivel> {
  const corte = empresa.data_corte;
  if (!corte) return { ok: false, motivo: 'corte', erro: 'O contabilista ainda não definiu a data de corte desta empresa.' };
  const periodo = periodoDoBalancete(ano, ate, corte);
  if (!periodo) return { ok: false, motivo: 'corte', erro: `Ainda não há meses de ${ano} fechados até à data de corte.` };
  const r = await daCache(empresa.id, empresa.cegid_versao, `balancete:${ano}:${periodo.ate}:${corte}`,
    () => balanceteDoCegid(empresa.id, ano, periodo.ate));
  if (!r.ok) return r;
  return { ok: true, dados: { ...periodo, corte, exercicio: r.dados.exercicio, linhas: r.dados.linhas, obtido_em: r.obtido_em } };
}

export type Extrato = {
  ano: number; inicio: string; fim: string; corte: string; conta: string; descricao: string;
  movimentos: Movimento[]; obtido_em: string;
};

export async function obterExtrato(empresa: Empresa, ano: number, conta: string): Promise<{ ok: true; dados: Extrato } | Indisponivel> {
  const corte = empresa.data_corte;
  if (!corte) return { ok: false, motivo: 'corte', erro: 'O contabilista ainda não definiu a data de corte desta empresa.' };
  if (!/^\d{1,15}$/.test(conta)) return { ok: false, motivo: 'pedido', erro: 'Conta inválida.' };
  const periodo = periodoDoExtrato(ano, corte);
  if (!periodo) return { ok: false, motivo: 'corte', erro: `O ano de ${ano} é posterior à data de corte.` };
  const r = await daCache(empresa.id, empresa.cegid_versao, `extrato:${ano}:${conta}:${periodo.fim}`,
    () => extratoDoCegid(empresa.id, ano, conta, periodo.inicio, periodo.fim));
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
