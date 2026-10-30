/* O estado dos documentos de um mês, como o cliente o lê. */
export type Mes = {
  mes: string; prazo: string; documentos: number; atrasados: number; devolvidos: number;
  completo_em: string | null; conferido_em: string | null; bloqueado?: boolean; fechado_em?: string | null;
};

export function estadoDoMes(m: Mes, agora = Date.now()) {
  if (m.fechado_em) return { estado: 'conferido', texto: 'Informação completa' };
  if (m.conferido_em) return { estado: 'conferido', texto: 'Conferido pelo contabilista' };
  if (m.completo_em) return { estado: 'completo', texto: 'Entregue — a aguardar conferência' };
  if (m.bloqueado) return { estado: 'completo', texto: 'Envio bloqueado' };
  if (Date.parse(m.prazo) <= agora) return { estado: 'atraso', texto: m.documentos ? 'Prazo terminado' : 'Prazo terminado sem documentos' };
  return { estado: 'aberto', texto: m.documentos ? 'Em curso' : 'Por enviar' };
}

/** O prazo dos documentos de um mês (AAAA-MM): o fim do dia 10 do seguinte. */
export function prazoDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const seguinte = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
  return `${seguinte.a}-${String(seguinte.m).padStart(2, '0')}-10`;
}

/** Os meses que se podem escolher para enviar documentos: o atual e os 23
    anteriores, como a base aceita. */
export function mesesParaEnviar(atual: string, quantos = 13) {
  const [a, m] = atual.split('-').map(Number);
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** O mês atual em Lisboa, AAAA-MM. */
export function mesAtualEmLisboa(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(agora);
  const ano = partes.find((x) => x.type === 'year')?.value;
  const mes = partes.find((x) => x.type === 'month')?.value;
  return `${ano}-${mes}`;
}
