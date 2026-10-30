export const TIPOS_IMPOSTO: Record<string, string> = {
  IRC: 'IRC', IVA: 'IVA', IRS: 'IRS (retenções)', SS: 'Segurança Social', OUTROS: 'Outros',
};

export type Imposto = {
  id: string; tipo: string; periodo: string; descricao: string | null; referencia: string | null;
  valor: number | null; prazo: string | null; estado: string; pago_em: string | null; criado_em: string;
};

/** Por pagar, em atraso ou pago — o que o cliente precisa de ver primeiro. */
export function situacao(i: Pick<Imposto, 'estado' | 'prazo'>, hoje: string) {
  if (i.estado === 'pago') return 'pago';
  return i.prazo && i.prazo < hoje ? 'atraso' : 'aberto';
}
