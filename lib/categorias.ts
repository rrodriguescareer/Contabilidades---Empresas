export const CATEGORIAS = [
  { valor: 'vendas', nome: 'Vendas', nota: 'Faturas emitidas, notas de crédito, resumos do POS' },
  { valor: 'compras', nome: 'Compras e despesas', nota: 'Faturas de fornecedores, combustível, telecomunicações' },
  { valor: 'bancos', nome: 'Bancos', nota: 'Extratos bancários e de cartões, comprovativos' },
  { valor: 'pessoal', nome: 'Pessoal', nota: 'Faltas, férias, admissões, saídas, ajudas de custo' },
  { valor: 'outros', nome: 'Outros', nota: 'Contratos, cartas das Finanças ou da Segurança Social' },
] as const;

export const nomeDaCategoria = (v: string) => CATEGORIAS.find((c) => c.valor === v)?.nome ?? v;
