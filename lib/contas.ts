import type { LinhaBalancete } from './cegid';

/* Leituras do balancete: que contas são de movimento, que contas pertencem a
   cada secção do portal, e os números do início. Funções puras. */

/** As contas sem sub-contas no balancete: cada valor conta uma só vez.
    Ordenadas por conta, as filhas vêm logo a seguir à mãe ("21", "211"…). */
export function contasDeMovimento(linhas: LinhaBalancete[]) {
  const ordenadas = [...linhas].sort((a, b) => (a.conta < b.conta ? -1 : a.conta > b.conta ? 1 : 0));
  return ordenadas.filter((l, i) => {
    const seguinte = ordenadas[i + 1]?.conta;
    return !(seguinte && seguinte !== l.conta && seguinte.startsWith(l.conta));
  });
}

/** As secções do portal que leem um grupo de contas do SNC. */
export const SECOES_DE_CONTAS = {
  clientes: { prefixos: ['21'], titulo: 'Clientes', positivo: 'A receber', negativo: 'Adiantamentos recebidos', sinal: 1 },
  fornecedores: { prefixos: ['22'], titulo: 'Fornecedores', positivo: 'A pagar', negativo: 'Adiantamentos pagos', sinal: -1 },
  bancos: { prefixos: ['11', '12', '13'], titulo: 'Bancos e caixa', positivo: 'Disponível', negativo: 'Descoberto', sinal: 1 },
} as const;
export type SecaoDeContas = keyof typeof SECOES_DE_CONTAS;

export function contasDaSecao(linhas: LinhaBalancete[], secao: SecaoDeContas) {
  const { prefixos } = SECOES_DE_CONTAS[secao];
  return contasDeMovimento(linhas).filter((l) => prefixos.some((x) => l.conta.startsWith(x)));
}

export const NIVEIS = [
  { valor: '2', nome: 'Resumido (contas de 2 dígitos)' },
  { valor: '4', nome: 'Por sub-contas (até 4 dígitos)' },
  { valor: '0', nome: 'Completo (todas as contas)' },
];

/** O balancete ao nível pedido: até N dígitos de conta (0 = todas). */
export function aoNivel(linhas: LinhaBalancete[], digitos: number) {
  return digitos > 0 ? linhas.filter((l) => l.conta.length <= digitos) : linhas;
}

/** Totais de controlo: somados nas contas de movimento, cada valor uma vez. */
export function totais(linhas: LinhaBalancete[]) {
  return contasDeMovimento(linhas).reduce(
    (t, l) => ({
      debito: t.debito + l.debito,
      credito: t.credito + l.credito,
      devedor: t.devedor + (l.saldo > 0 ? l.saldo : 0),
      credor: t.credor + (l.saldo < 0 ? -l.saldo : 0),
    }),
    { debito: 0, credito: 0, devedor: 0, credor: 0 },
  );
}

/** Os números do início, a partir do balancete do último mês fechado. */
export function indicadores(linhas: LinhaBalancete[]) {
  const folhas = contasDeMovimento(linhas);
  const soma = (...prefixos: string[]) =>
    folhas.filter((l) => prefixos.some((x) => l.conta.startsWith(x))).reduce((t, l) => t + l.saldo, 0);
  const operacoes = soma('6', '7');
  return {
    disponivel: soma('11', '12', '13'),
    clientes: soma('21'),
    fornecedores: -soma('22'),
    // Antes do apuramento, o resultado está nas classes 6 e 7; depois, na 81.
    resultado: Math.abs(operacoes) > 0.005 ? -operacoes : -soma('81'),
  };
}
