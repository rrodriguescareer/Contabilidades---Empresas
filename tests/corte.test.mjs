import test from 'node:test';
import assert from 'node:assert/strict';
import { anosDisponiveis, mesesPermitidos, periodoDoBalancete, periodoDoExtrato, semDepoisDoCorte, ultimoMesFechado } from '../lib/corte.ts';
import { aoNivel, contasDaSecao, contasDeMovimento, indicadores, totais } from '../lib/contas.ts';
import { estadoDoMes, mesesParaEnviar, prazoDoMes } from '../lib/meses.ts';

test('the last closed month only counts months that ended by the cut-off date', () => {
  assert.deepEqual(ultimoMesFechado('2026-09-30'), { ano: 2026, mes: 9 });
  assert.deepEqual(ultimoMesFechado('2026-09-29'), { ano: 2026, mes: 8 });
  assert.deepEqual(ultimoMesFechado('2026-01-15'), { ano: 2025, mes: 12 });
  assert.deepEqual(ultimoMesFechado('2024-02-29'), { ano: 2024, mes: 2 });
  assert.equal(ultimoMesFechado(null), null);
  assert.equal(ultimoMesFechado('2026-02-30'), null);
  assert.equal(ultimoMesFechado('30/09/2026'), null);
});

test('a trial balance never goes past the cut-off, whatever is asked', () => {
  assert.equal(mesesPermitidos(2026, '2026-09-30'), 9);
  assert.equal(mesesPermitidos(2025, '2026-09-30'), 12);
  assert.equal(mesesPermitidos(2027, '2026-09-30'), 0);
  assert.equal(mesesPermitidos(2026, null), 0);
  assert.deepEqual(periodoDoBalancete(2026, 12, '2026-09-30'), { ano: 2026, de: 1, ate: 9, fim: '2026-09-30' });
  assert.deepEqual(periodoDoBalancete(2026, 3, '2026-09-30'), { ano: 2026, de: 1, ate: 3, fim: '2026-03-31' });
  assert.deepEqual(periodoDoBalancete(2026, Number.NaN, '2026-09-15'), { ano: 2026, de: 1, ate: 8, fim: '2026-08-31' });
  assert.equal(periodoDoBalancete(2027, 1, '2026-09-30'), null);
  assert.equal(periodoDoBalancete(2026, 1, '2026-01-20'), null);
  assert.deepEqual(anosDisponiveis('2026-01-20', 3), [2025, 2024, 2023]);
});

test('statements stop at the cut-off day and drop anything later', () => {
  assert.deepEqual(periodoDoExtrato(2026, '2026-09-15'), { inicio: '2026-01-01', fim: '2026-09-15' });
  assert.deepEqual(periodoDoExtrato(2025, '2026-09-15'), { inicio: '2025-01-01', fim: '2025-12-31' });
  assert.equal(periodoDoExtrato(2027, '2026-09-15'), null);
  const linhas = [{ data: null }, { data: '2026-09-15' }, { data: '2026-09-16' }, { data: '2026-10-01T00:00:00' }];
  assert.deepEqual(semDepoisDoCorte(linhas, '2026-09-15'), [{ data: null }, { data: '2026-09-15' }]);
});

const l = (conta, debito, credito) => ({ conta, descricao: conta, nivel: conta.length, classe: conta[0], integradora: false,
  debito_anterior: 0, credito_anterior: 0, debito_periodo: debito, credito_periodo: credito, debito, credito, saldo: debito - credito });

test('totals and sections read each amount once, from movement accounts', () => {
  const linhas = [
    l('1', 1000, 200), l('12', 1000, 200), l('121', 700, 200), l('122', 300, 0),
    l('2', 500, 900), l('21', 500, 100), l('211', 500, 100), l('22', 0, 800), l('221', 0, 800),
    l('6', 300, 0), l('62', 300, 0), l('7', 0, 100), l('72', 0, 100),
  ];
  assert.deepEqual(contasDeMovimento(linhas).map((x) => x.conta), ['121', '122', '211', '221', '62', '72']);
  assert.deepEqual(totais(linhas), { debito: 1800, credito: 1200, devedor: 1500, credor: 900 });
  assert.deepEqual(contasDaSecao(linhas, 'bancos').map((x) => x.conta), ['121', '122']);
  assert.deepEqual(aoNivel(linhas, 2).map((x) => x.conta), ['1', '12', '2', '21', '22', '6', '62', '7', '72']);
  assert.deepEqual(indicadores(linhas), { disponivel: 800, clientes: 400, fornecedores: 800, resultado: -200 });
});

test('documents are due on the 10th of the following month', () => {
  assert.equal(prazoDoMes('2026-09'), '2026-10-10');
  assert.equal(prazoDoMes('2026-12'), '2027-01-10');
  assert.deepEqual(mesesParaEnviar('2026-02', 3), ['2026-02', '2026-01', '2025-12']);
  const mes = { mes: '2026-09-01', prazo: '2026-10-10T23:00:00Z', documentos: 2, atrasados: 0, devolvidos: 0, completo_em: null, conferido_em: null };
  assert.equal(estadoDoMes(mes, Date.parse('2026-10-05')).estado, 'aberto');
  assert.equal(estadoDoMes(mes, Date.parse('2026-10-12')).estado, 'atraso');
  assert.equal(estadoDoMes({ ...mes, completo_em: '2026-10-01' }, Date.parse('2026-10-12')).estado, 'completo');
});
