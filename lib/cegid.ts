import 'server-only';
import { adminClient, adminConfigured } from './admin-client';
import { decryptSecret, encryptSecret } from './secret-crypto';

/* O Cegid Business de cada empresa.
 *
 * O Cegid tem uma conta por empresa, por isso cada empresa tem as suas
 * credenciais, cifradas em integration_secrets com o âmbito cegid:<empresa>.
 * O contabilista grava-as na Gestão; aqui só se leem e se atualizam os tokens.
 *
 * Autenticação: authorization code sem ecrã (o /auth responde 302 com o código
 * no Location), e cada renovação troca também o refresh token — os dois são
 * gravados de cada vez. Depois, para as rotas de contabilidade, o Cegid exige
 * escolher o exercício fiscal (PUT /entity_sub_switch), que devolve um token
 * próprio desse exercício. Esse fica guardado por exercício, com a validade.
 */

const OAUTH_PADRAO = process.env.CEGID_OAUTH_URL || 'https://app2.business-pt.cegid.cloud/oauth';
const API_PADRAO = process.env.CEGID_API_URL || 'https://api2.business-pt.cegid.cloud';
const REDIRECT = process.env.CEGID_REDIRECT_URI || 'https://oauth.pstmn.io/v1/callback';
const ESCOPO = 'commercial';

type Cofre = {
  identificador: string;
  segredo: string;
  oauth_url?: string;
  api_url?: string;
  access_token?: string;
  refresh_token?: string;
  expira_em?: number;
  exercicios?: Record<string, { token: string; expira_em: number }>;
};

export type Falha = { ok: false; erro: string; motivo: 'configuracao' | 'credenciais' | 'cegid' | 'exercicio' };
export type Resultado<T> = { ok: true; dados: T } | Falha;

const falha = (motivo: Falha['motivo'], erro: string): Falha => ({ ok: false, erro, motivo });
const ambito = (empresa: string) => `cegid:${empresa}`;

/** Lê as credenciais da empresa. Aceita também o formato antigo da Gestão, uma
    só linha "identificador:segredo". */
async function lerCofre(empresa: string): Promise<Resultado<Cofre>> {
  if (!adminConfigured()) {
    return falha('configuracao', 'A ligação ao Cegid ainda não está configurada nesta plataforma.');
  }
  const { data, error } = await adminClient()
    .from('integration_secrets').select('encrypted_value').eq('scope', ambito(empresa)).maybeSingle();
  if (error) return falha('configuracao', 'Não foi possível ler a configuração do Cegid.');
  if (!data?.encrypted_value) {
    return falha('credenciais', 'O contabilista ainda não ligou esta empresa ao Cegid.');
  }
  let texto: string;
  try {
    texto = decryptSecret(data.encrypted_value, ambito(empresa));
  } catch {
    return falha('configuracao', 'As credenciais do Cegid não puderam ser lidas. Confirme a chave de cifragem.');
  }
  try {
    const cofre = JSON.parse(texto) as Cofre;
    if (cofre?.identificador && cofre?.segredo) return { ok: true, dados: cofre };
  } catch {
    const [identificador, ...resto] = texto.split(':');
    if (identificador && resto.length) return { ok: true, dados: { identificador: identificador.trim(), segredo: resto.join(':').trim() } };
  }
  return falha('credenciais', 'As credenciais do Cegid desta empresa estão incompletas. O contabilista tem de as voltar a gravar.');
}

async function gravarCofre(empresa: string, cofre: Cofre) {
  try {
    await adminClient().from('integration_secrets').upsert({
      scope: ambito(empresa),
      encrypted_value: encryptSecret(JSON.stringify(cofre), ambito(empresa)),
      updated_at: new Date().toISOString(),
    });
  } catch (erro) {
    console.error(JSON.stringify({ event: 'rr_cegid_cofre', erro: String((erro as Error)?.message || erro) }));
  }
}

const oauth = (c: Cofre) => (c.oauth_url || OAUTH_PADRAO).replace(/\/$/, '');
const api = (c: Cofre) => (c.api_url || API_PADRAO).replace(/\/$/, '');
const basica = (c: Cofre) => 'Basic ' + Buffer.from(`${c.identificador}:${c.segredo}`).toString('base64');

/* A margem é proporcional: há contas que devolvem quatro horas de validade. */
const validade = (segundos: unknown) => {
  const vida = Math.max(0, Number(segundos) || 0);
  return Date.now() + (vida - Math.min(300, Math.floor(vida / 10))) * 1000;
};

async function trocarPorTokens(empresa: string, cofre: Cofre, corpo: Record<string, string>): Promise<Cofre> {
  const resposta = await fetch(`${oauth(cofre)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: basica(cofre) },
    body: new URLSearchParams({ ...corpo, scope: ESCOPO }),
    cache: 'no-store',
  });
  if (!resposta.ok) throw new Error(`O Cegid recusou a autenticação (${resposta.status}).`);
  const dados = (await resposta.json()) as { access_token: string; refresh_token: string; expires_in: number };
  const novo: Cofre = {
    ...cofre,
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    expira_em: validade(dados.expires_in),
    exercicios: {}, // um token novo começa sem exercício escolhido
  };
  await gravarCofre(empresa, novo);
  return novo;
}

async function autorizar(empresa: string, cofre: Cofre): Promise<Cofre> {
  const url = new URL(`${oauth(cofre)}/auth`);
  url.searchParams.set('client_id', cofre.identificador);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ESCOPO);
  // O código vem no Location do 302: seguir o redirecionamento perdia-o.
  const resposta = await fetch(url, { redirect: 'manual', cache: 'no-store' });
  const destino = resposta.headers.get('location');
  const codigo = destino ? new URL(destino, REDIRECT).searchParams.get('code') : null;
  if (codigo) return trocarPorTokens(empresa, cofre, { grant_type: 'authorization_code', code: codigo });
  // Algumas contas só aceitam client_credentials.
  return trocarPorTokens(empresa, cofre, { grant_type: 'client_credentials' });
}

async function tokenBase(empresa: string, cofre: Cofre, forcar = false): Promise<Cofre> {
  if (!forcar && cofre.access_token && cofre.expira_em && cofre.expira_em > Date.now()) return cofre;
  if (cofre.refresh_token) {
    try {
      return await trocarPorTokens(empresa, cofre, { grant_type: 'refresh_token', refresh_token: cofre.refresh_token });
    } catch {
      /* refresh gasto ou revogado: autoriza-se de raiz */
    }
  }
  return autorizar(empresa, cofre);
}

const cabecalhos = (token: string) => ({
  Accept: 'application/json',
  'Content-Type': 'application/vnd.api+json',
  Authorization: `Bearer ${token}`,
});

function erroDoCegid(estado: number, texto: string) {
  try {
    const corpo = JSON.parse(texto) as Record<string, unknown>;
    const erros = corpo.errors;
    if (Array.isArray(erros) && erros.length) {
      const e = erros[0] as Record<string, unknown>;
      const d = e.detail || e.title || e.message;
      if (typeof d === 'string') return `O Cegid respondeu: ${d}`;
    }
    for (const k of ['message', 'error', 'detail']) if (typeof corpo[k] === 'string') return `O Cegid respondeu: ${corpo[k]}`;
  } catch {
    /* não era JSON */
  }
  return `O Cegid recusou o pedido (${estado}).`;
}

type Exercicio = {
  id: string; ano: number; fim: number; inicio_mes: number; fim_mes: number; nome: string;
  principal: boolean; leitura: boolean; fechado_em: string | null;
};

async function listarExercicios(cofre: Cofre): Promise<{ estado: number; lista?: Exercicio[]; texto?: string }> {
  const r = await fetch(`${api(cofre)}/fiscal_years_list`, { headers: cabecalhos(cofre.access_token!), cache: 'no-store' });
  const texto = await r.text();
  if (!r.ok) return { estado: r.status, texto };
  const corpo = JSON.parse(texto) as { data?: { id: string; attributes?: Record<string, unknown> }[] };
  const lista = (corpo.data || []).map((x) => {
    const a = x.attributes || {};
    return {
      id: String(x.id),
      ano: Number(a.fiscal_year),
      fim: Number(a.fiscal_year_end ?? a.fiscal_year),
      inicio_mes: Number(a.start_month ?? 1),
      fim_mes: Number(a.end_month ?? 12),
      nome: String(a.fiscal_year_name ?? `Exercício de ${a.fiscal_year}`),
      principal: a.is_default_per_year !== false,
      leitura: a.read_permission !== false,
      fechado_em: (a.closed_at as string) || null,
    };
  });
  return { estado: 200, lista };
}

/** Uma sessão autenticada no exercício do ano pedido, pronta para os
    relatórios. Faz tudo o que for preciso: token, renovação e escolha do
    exercício; e repete uma vez se o Cegid recusar um token guardado. */
async function sessaoDoAno(empresa: string, ano: number): Promise<Resultado<{ cofre: Cofre; token: string; exercicio: Exercicio }>> {
  const lido = await lerCofre(empresa);
  if (!lido.ok) return lido;
  let cofre: Cofre;
  try {
    cofre = await tokenBase(empresa, lido.dados);
  } catch (e) {
    return falha('cegid', (e as Error).message);
  }

  let lista = await listarExercicios(cofre);
  if (lista.estado === 401) {
    try {
      cofre = await tokenBase(empresa, cofre, true);
    } catch (e) {
      return falha('cegid', (e as Error).message);
    }
    lista = await listarExercicios(cofre);
  }
  if (!lista.lista) return falha('cegid', erroDoCegid(lista.estado, lista.texto || ''));

  const candidatos = lista.lista.filter((x) => x.ano === ano && x.leitura);
  const exercicio = candidatos.find((x) => x.principal) || candidatos[0];
  if (!exercicio) return falha('exercicio', `O exercício de ${ano} não existe no Cegid desta empresa.`);

  const guardado = cofre.exercicios?.[exercicio.id];
  if (guardado && guardado.expira_em > Date.now()) return { ok: true, dados: { cofre, token: guardado.token, exercicio } };

  const r = await fetch(`${api(cofre)}/entity_sub_switch`, {
    method: 'PUT',
    headers: { ...cabecalhos(cofre.access_token!), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sub-switch', to_subtype: 'fiscal-year', to_subentity_id: exercicio.id }),
    cache: 'no-store',
  });
  const texto = await r.text();
  if (!r.ok) return falha('cegid', erroDoCegid(r.status, texto));
  let token = '';
  let ttl = 0;
  try {
    const corpo = JSON.parse(texto) as { access_token?: string; access_ttl?: string | number; data?: { attributes?: { access_token?: string; access_ttl?: number } } };
    token = corpo.access_token || corpo.data?.attributes?.access_token || '';
    ttl = Number(corpo.access_ttl ?? corpo.data?.attributes?.access_ttl ?? 3600);
  } catch {
    /* tratado abaixo */
  }
  if (!token) return falha('cegid', 'O Cegid não devolveu o acesso ao exercício.');
  cofre = { ...cofre, exercicios: { ...(cofre.exercicios || {}), [exercicio.id]: { token, expira_em: validade(ttl) } } };
  await gravarCofre(empresa, cofre);
  return { ok: true, dados: { cofre, token, exercicio } };
}

type Linha = Record<string, unknown>;

/** Um relatório de contabilidade (recurso individual com as linhas incluídas). */
async function relatorio(empresa: string, ano: number, recurso: string, filtros: Record<string, string | number | boolean>): Promise<Resultado<{ cabecalho: Linha; linhas: Linha[]; exercicio: Exercicio }>> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const sessao = await sessaoDoAno(empresa, ano);
    if (!sessao.ok) return sessao;
    const url = new URL(`${api(sessao.dados.cofre)}/${recurso}/0`);
    url.searchParams.set('include', 'lines');
    for (const [k, v] of Object.entries(filtros)) url.searchParams.set(`filter[${k}]`, String(v));
    const r = await fetch(url, { headers: cabecalhos(sessao.dados.token), cache: 'no-store' });
    const texto = await r.text();
    if (r.status === 401 && tentativa === 0) {
      // O token do exercício caducou antes do previsto: esquece-o e repete.
      const { exercicios, ...resto } = sessao.dados.cofre;
      void exercicios;
      await gravarCofre(empresa, { ...resto, exercicios: {} });
      continue;
    }
    if (!r.ok) return falha('cegid', erroDoCegid(r.status, texto));
    try {
      const corpo = JSON.parse(texto) as { data?: { attributes?: Linha }; included?: { attributes?: Linha }[] };
      return {
        ok: true,
        dados: {
          cabecalho: corpo.data?.attributes || {},
          linhas: (corpo.included || []).map((x) => x.attributes || {}),
          exercicio: sessao.dados.exercicio,
        },
      };
    } catch {
      return falha('cegid', 'O Cegid respondeu num formato inesperado.');
    }
  }
  return falha('cegid', 'O Cegid recusou o acesso ao exercício.');
}

/* ------------------------------------------------------------- relatórios */

const numero = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);

export type LinhaBalancete = {
  conta: string;
  descricao: string;
  nivel: number;
  classe: string;
  integradora: boolean;
  debito_anterior: number;
  credito_anterior: number;
  debito_periodo: number;
  credito_periodo: number;
  debito: number; // acumulado
  credito: number; // acumulado
  saldo: number; // devedor positivo, credor negativo
};

export async function balanceteDoCegid(empresa: string, ano: number, ate: number): Promise<Resultado<{ linhas: LinhaBalancete[]; exercicio: string }>> {
  const r = await relatorio(empresa, ano, 'trial_balance_period', {
    period_month: 1,
    end_period_month: ate,
    level: 20,
    hide_third_party_accounts: false,
    include_zeroes: false,
  });
  if (!r.ok) return r;
  const linhas = r.dados.linhas
    .map((l): LinhaBalancete => {
      const debito = numero(l.debit3_amount);
      const credito = numero(l.credit3_amount);
      const saldo = l.movement_balance != null ? numero(l.movement_balance) : debito - credito;
      return {
        conta: String(l.account_id ?? '').trim(),
        descricao: String(l.account_description ?? '').trim(),
        nivel: Number(l.level) || String(l.account_id ?? '').length,
        classe: String(l.class ?? String(l.account_id ?? '').slice(0, 1)),
        integradora: Boolean(l.is_integrator),
        debito_anterior: numero(l.debit1_amount),
        credito_anterior: numero(l.credit1_amount),
        debito_periodo: numero(l.debit2_amount),
        credito_periodo: numero(l.credit2_amount),
        debito,
        credito,
        saldo,
      };
    })
    .filter((l) => l.conta)
    .sort((a, b) => (a.conta < b.conta ? -1 : a.conta > b.conta ? 1 : 0));
  return { ok: true, dados: { linhas, exercicio: r.dados.exercicio.nome } };
}

export type Movimento = {
  data: string | null;
  documento: string | null;
  diario: string | null;
  descricao: string;
  terceiro: string | null;
  nif: string | null;
  debito: number;
  credito: number;
  inicial: boolean;
};

export async function extratoDoCegid(empresa: string, ano: number, conta: string, inicio: string, fim: string): Promise<Resultado<{ conta: string; descricao: string; movimentos: Movimento[] }>> {
  const r = await relatorio(empresa, ano, 'account_statement', {
    first_account: conta,
    last_account: conta,
    start_date: inicio,
    end_date: fim,
    include_zeroes: true,
  });
  if (!r.ok) return r;
  const daConta = r.dados.linhas.filter((l) => String(l.account_id ?? '') === conta);
  const movimentos = daConta
    .sort((a, b) => numero(a.detail_order) - numero(b.detail_order))
    .map((l): Movimento => {
      const inicial = numero(l.detail_order) === 0 && !l.transaction_date;
      return {
        data: l.transaction_date ? String(l.transaction_date).slice(0, 10) : null,
        documento: (l.document_no as string) || (l.accountable_document_no as string) || null,
        diario: (l.journal_id as string) || null,
        descricao: String(l.full_description || l.description || (inicial ? 'Saldo inicial' : '')),
        terceiro: (l.third_party_name as string) || null,
        nif: (l.third_party_tax_number as string) || null,
        debito: numero(l.debit_final_amount),
        credito: numero(l.credit_final_amount),
        inicial,
      };
    });
  return {
    ok: true,
    dados: { conta, descricao: String(daConta[0]?.account_description ?? ''), movimentos },
  };
}

/** Para a Gestão confirmar que as credenciais servem. */
export async function exerciciosDoCegid(empresa: string): Promise<Resultado<{ ano: number; nome: string }[]>> {
  const lido = await lerCofre(empresa);
  if (!lido.ok) return lido;
  try {
    const cofre = await tokenBase(empresa, lido.dados);
    const lista = await listarExercicios(cofre);
    if (!lista.lista) return falha('cegid', erroDoCegid(lista.estado, lista.texto || ''));
    return { ok: true, dados: lista.lista.map((x) => ({ ano: x.ano, nome: x.nome })) };
  } catch (e) {
    return falha('cegid', (e as Error).message);
  }
}
