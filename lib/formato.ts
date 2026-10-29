/* Números, datas e meses como se escrevem em Portugal. */

// Agrupar sempre: em pt-PT, 2000,00 sai sem espaço e 20 000,00 com ele, e numa
// coluna de valores isso desalinha a leitura.
const EUROS = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions);

/** 1 234,56 — sem símbolo, para colunas de tabela. */
export const valor = (n: number) => EUROS.format(Math.abs(n) < 0.005 ? 0 : n);
export const euros = (n: number) => `${valor(n)} €`;

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 30/09/2026 */
export function data(iso: string | null | undefined) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** 30 de setembro de 2026 */
export function dataLonga(iso: string | null | undefined) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** 30/09/2026, 14:05 (hora de Lisboa) */
export function dataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** setembro de 2026, a partir de 2026-09-01 */
export function mesAno(iso: string | null | undefined) {
  if (!iso) return '—';
  const [a, m] = iso.slice(0, 7).split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Saldo com natureza: devedor/credor. */
export function natureza(saldo: number) {
  if (Math.abs(saldo) < 0.005) return '';
  return saldo > 0 ? 'D' : 'C';
}
