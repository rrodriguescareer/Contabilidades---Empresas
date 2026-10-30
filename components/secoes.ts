export const SECOES = [
  { segmento: '', nome: 'Visão geral', icone: 'inicio', nota: 'O estado da contabilidade e o que falta da sua parte.' },
  { segmento: 'documentos', nome: 'Documentos do mês', icone: 'documentos', nota: 'Envie os documentos de cada mês até ao dia 10 do mês seguinte.' },
  { segmento: 'impostos', nome: 'Impostos', icone: 'impostos', nota: 'O que há para pagar, até quando, e os comprovativos.' },
  { segmento: 'pessoal', nome: 'Pessoal', icone: 'pessoal', nota: 'Admissões, saídas, ausências e os recibos de vencimento.' },
  { segmento: 'balancete', nome: 'Balancete', icone: 'balancete', nota: 'Balancetes fechados até à data de corte, em PDF ou Excel.' },
  { segmento: 'contas', nome: 'Contas e saldos', icone: 'contas', nota: 'O saldo de cada conta no último mês fechado.' },
  { segmento: 'clientes', nome: 'Clientes', icone: 'clientes', nota: 'Quanto lhe devem e o histórico de cada cliente.' },
  { segmento: 'fornecedores', nome: 'Fornecedores', icone: 'fornecedores', nota: 'Quanto deve e o histórico de cada fornecedor.' },
  { segmento: 'bancos', nome: 'Bancos e caixa', icone: 'bancos', nota: 'Saldos e movimentos das contas bancárias e da caixa.' },
  { segmento: 'mensagens', nome: 'Mensagens', icone: 'mensagens', nota: 'Fale diretamente com o contabilista.' },
  { segmento: 'prazos', nome: 'Prazos', icone: 'prazos', nota: 'As datas que importam para a sua empresa.' },
  { segmento: 'dados', nome: 'Dados da empresa', icone: 'empresa', nota: 'A ficha da empresa, o logótipo e o histórico de alterações.' },
  { segmento: 'atividade', nome: 'Atividade', icone: 'atividade', nota: 'O registo do que foi feito nesta empresa, e quando.' },
] as const;

export const logotipoUrl = (empresa: { id: string; logotipo: string | null; logotipo_em: string | null }) =>
  empresa.logotipo ? `/app/${empresa.id}/logotipo?v=${encodeURIComponent(empresa.logotipo_em || '')}` : null;
