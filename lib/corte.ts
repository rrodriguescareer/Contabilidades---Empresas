/* A data de corte: até onde a contabilidade de uma empresa está revista.
 *
 * É a regra que define o portal. Um balancete entregue a um banco tem de ser
 * de um período fechado; por isso nada do que sai daqui passa da data de corte.
 *
 * O Cegid devolve balancetes por mês. Um mês só entra se tiver terminado até à
 * data de corte: com corte a 15 de setembro, o último balancete é o de agosto.
 * Os extratos (movimentos de uma conta) vão até ao próprio dia.
 *
 * Funções puras, sem dependências, para se poderem testar à parte.
 */

export type Limite = { ano: number; mes: number };

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function partes(data: string | null | undefined) {
  const m = DATA.exec(data || '');
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(ano, mes)) return null;
  return { ano, mes, dia };
}

export function diasDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** O último mês fechado: o mês da data de corte se ela for o último dia dele,
    senão o mês anterior. Sem data de corte, nada. */
export function ultimoMesFechado(corte: string | null | undefined): Limite | null {
  const p = partes(corte);
  if (!p) return null;
  if (p.dia === diasDoMes(p.ano, p.mes)) return { ano: p.ano, mes: p.mes };
  return p.mes === 1 ? { ano: p.ano - 1, mes: 12 } : { ano: p.ano, mes: p.mes - 1 };
}

/** Até que mês de um ano se pode tirar o balancete (0 = nenhum). */
export function mesesPermitidos(ano: number, corte: string | null | undefined) {
  const limite = ultimoMesFechado(corte);
  if (!limite || ano > limite.ano) return 0;
  return ano < limite.ano ? 12 : limite.mes;
}

/** Os anos com algum mês fechado, do mais recente para trás (no máximo seis). */
export function anosDisponiveis(corte: string | null | undefined, quantos = 6) {
  const limite = ultimoMesFechado(corte);
  if (!limite) return [];
  return Array.from({ length: quantos }, (_, i) => limite.ano - i);
}

/** Valida o pedido de balancete contra a data de corte. Nunca alarga: o mês
    pedido é reduzido ao último permitido. */
export function periodoDoBalancete(ano: number, ate: number, corte: string | null | undefined) {
  const maximo = mesesPermitidos(ano, corte);
  if (!Number.isInteger(ano) || maximo === 0) return null;
  const mes = Number.isInteger(ate) && ate >= 1 ? Math.min(ate, maximo) : maximo;
  return { ano, de: 1, ate: mes, fim: iso(ano, mes, diasDoMes(ano, mes)) };
}

/** O intervalo de um extrato num ano: de 1 de janeiro até ao fim do ano ou à
    data de corte, o que vier primeiro. */
export function periodoDoExtrato(ano: number, corte: string | null | undefined) {
  const p = partes(corte);
  if (!p || !Number.isInteger(ano) || ano > p.ano) return null;
  return { inicio: iso(ano, 1, 1), fim: ano < p.ano ? iso(ano, 12, 31) : (corte as string) };
}

/** A última barreira: tira qualquer linha com data posterior ao corte, mesmo
    que o Cegid a devolva. Linhas sem data (saldo inicial) ficam. */
export function semDepoisDoCorte<T extends { data?: string | null }>(linhas: T[], corte: string) {
  return linhas.filter((l) => !l.data || l.data.slice(0, 10) <= corte);
}
