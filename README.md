# Clientes Empresa — portal.rr-contabilidade.com

Terceira plataforma, para os clientes de contabilidade organizada (sociedades e
independentes). Next.js 16 (App Router), React 19, CSS Modules, `@supabase/ssr`,
o **mesmo** projeto Supabase do IRS e da Gestão (`rllajahyovpzndbbyvcd`).

## O que faz

- **Visão geral** de cada empresa: prazo dos documentos do mês, números do último
  mês fechado (bancos, clientes, fornecedores, resultado), mensagens, prazos e
  atividade.
- **Balancete** do Cegid Business, de janeiro até ao mês escolhido, com três níveis
  de detalhe, e **descarga em PDF e Excel** com a data de corte impressa em cada
  página, quem o tirou, quando, e uma referência que fica no registo de atividade.
- **Contas e saldos**, **Clientes**, **Fornecedores** e **Bancos e caixa**, com o
  **extrato** (histórico de movimentos) de cada conta.
- **Documentos do mês**: envio até ao dia 10 do mês seguinte (hora de Lisboa);
  os que chegam depois ficam marcados como fora do prazo e o contabilista é
  avisado por email. Imagens passam a WebP (`sharp`, como no IRS); PDF ficam como
  vêm. Storage privado (`empresas-documentos`).
- **Mensagens** com o contabilista, **Prazos** (os do gabinete e o do dia 10) e
  **Atividade**.

## A regra que define a plataforma

Cada empresa tem uma **data de corte**, definida pelo contabilista na Gestão. Nada
passa dela:

- balancetes só por meses **completos** até à data de corte (corte a 15/09 → o
  último balancete é o de agosto);
- extratos até ao próprio dia; as linhas posteriores são retiradas no servidor,
  mesmo que o Cegid as devolva;
- sem data de corte, não há saldos nem balancetes.

As regras estão em `lib/corte.ts` e testadas em `tests/corte.test.mjs`.

## Cegid

Uma conta Cegid **por empresa**. As credenciais (identificador e segredo da API,
de *Empresa → Configurações → Dados API*) gravam-se na Gestão → Empresas → a
empresa, e ficam cifradas (AES-256-GCM) em `integration_secrets` com o âmbito
`cegid:<empresa>`. O portal autentica (authorization code sem ecrã, com
renovação), escolhe o exercício fiscal (`PUT /entity_sub_switch`) e lê
`trial_balance_period` e `account_statement`. As respostas ficam 6 horas em
`empresa_cegid_cache` (só o servidor lê); mudar a data de corte apaga a cache.

## Acessos

Os utilizadores são criados pelo contabilista na Gestão (não há registo). Para
entrar aqui é preciso o acesso **Empresas** (`definir_acessos`) e estar associado
à empresa em `company_users`. A mesma conta serve o IRS. O contabilista vê todas
as empresas, como o cliente as vê.

## Base de dados

Migração `gestao-clientes/supabase/migrations/202610300060_portal_empresas.sql`
(fonte de verdade das três plataformas), com testes em
`gestao-clientes/tests/empresas.test.mjs`.

## Desenvolver

```bash
npm install
npm run dev -- --port 3003
npm test
npm run build
```

`.env.local` a partir de `.env.example`. Sem `SUPABASE_SECRET_KEY` e
`INTEGRATION_ENCRYPTION_KEY`, o portal funciona (entrar, documentos, mensagens)
mas mostra que a ligação ao Cegid ainda não está configurada.

## Vercel

Projeto próprio, `regions: ["arn1"]`, Node 24, raiz do repositório. Variáveis:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SITE_URL=https://portal.rr-contabilidade.com`, `NEXT_PUBLIC_IRS_URL`,
`NEXT_PUBLIC_GESTAO_URL` e, privadas, `SUPABASE_SECRET_KEY`,
`INTEGRATION_ENCRYPTION_KEY` (a mesma das outras duas), `RESEND_API_KEY`.
No Supabase Auth, acrescentar o endereço do portal aos *Redirect URLs*.
