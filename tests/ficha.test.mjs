import test from 'node:test';
import assert from 'node:assert/strict';
import { ibanValido, lerFicha, nifValido } from '../lib/ficha.ts';
import { lerPessoal } from '../lib/pessoal.ts';
import { situacao } from '../lib/impostos.ts';
import { dominioDosCookies, opcoesDosCookies } from '../lib/cookies-partilhados.ts';

const form = (o) => ({ get: (k) => (k in o ? o[k] : null) });

test('NIF and IBAN check digits', () => {
  assert.equal(nifValido('500000000'), true);
  assert.equal(nifValido('123456789'), true);
  assert.equal(nifValido('158295974'), false);
  assert.equal(nifValido('012345678'), false);
  assert.equal(ibanValido('PT50000201231234567890154'), true);
  assert.equal(ibanValido('PT50000201231234567890155'), false);
});

test('the company file is normalised and explained when wrong', () => {
  const ok = lerFicha(form({ nome: ' Empresa, Lda ', nif: '500000000', iban: 'pt50 0002 0123 1234 5678 9015 4', capital_social: '5 000,5', tem_trabalhadores: 'on', cae: '69200, 70220' }));
  assert.equal(ok.dados.nome, 'Empresa, Lda');
  assert.equal(ok.dados.iban, 'PT50000201231234567890154');
  assert.equal(ok.dados.capital_social, '5000.50');
  assert.equal(ok.dados.tem_trabalhadores, true);
  assert.match(lerFicha(form({ nome: 'X', nif: '158295974' })).erro, /NIF inválido/);
  assert.match(lerFicha(form({ nome: 'X', nif: '500000000', codigo_postal: '4470' })).erro, /Código postal/);
  assert.match(lerFicha(form({ nome: 'X', nif: '500000000', niss: '123' })).erro, /NISS/);
  assert.match(lerFicha(form({ nome: '', nif: '500000000' })).erro, /Denominação/);
});

test('personnel communications keep only known fields and require the essentials', () => {
  const r = lerPessoal('ausencia', form({ trabalhador: 'Joana', tipo: 'Férias', de: '2026-08-01', ate: '2026-08-15', salario: '9999' }));
  assert.equal(r.trabalhador, 'Joana');
  assert.deepEqual(r.dados, { tipo: 'Férias', de: '2026-08-01', ate: '2026-08-15' });
  assert.match(lerPessoal('admissao', form({ trabalhador: 'Joana' })).erro, /obrigatório/);
  assert.match(lerPessoal('ausencia', form({ trabalhador: 'J', tipo: 'Inventado', de: '2026-08-01', ate: '2026-08-02' })).erro, /opção inválida/);
  assert.match(lerPessoal('xpto', form({})).erro, /tipo/);
});

test('taxes are overdue only when unpaid after the deadline', () => {
  assert.equal(situacao({ estado: 'por_pagar', prazo: '2026-10-20' }, '2026-10-21'), 'atraso');
  assert.equal(situacao({ estado: 'por_pagar', prazo: '2026-10-20' }, '2026-10-20'), 'aberto');
  assert.equal(situacao({ estado: 'pago', prazo: '2026-10-20' }, '2026-11-01'), 'pago');
});

test('session cookies are shared only under rr-contabilidade.com', () => {
  assert.equal(dominioDosCookies('portal.rr-contabilidade.com'), '.rr-contabilidade.com');
  assert.equal(dominioDosCookies('irs.rr-contabilidade.com:443'), '.rr-contabilidade.com');
  assert.equal(dominioDosCookies('rr-contabilidade.com.evil.pt'), undefined);
  assert.equal(dominioDosCookies('contabilidades-empresas.vercel.app'), undefined);
  assert.equal(dominioDosCookies('localhost:3003'), undefined);
  assert.equal(opcoesDosCookies('gestao.rr-contabilidade.com').secure, true);
});
