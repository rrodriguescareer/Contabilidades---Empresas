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
- **Impostos** (IRC, IVA, IRS, Segurança Social, outros): o contabilista publica
  o período com a guia, a referência, o valor e o prazo; o cliente recebe email,
  vê o que está em atraso, marca como pago e junta o comprovativo.
- **Pessoal** (só para empresas com trabalhadores): admissões, cessações,
  ausências e alterações com os dados e documentos de que o contabilista
  precisa; e os recibos de vencimento de cada mês, um PDF por mês.
- **Dados da empresa**: a ficha (NIF, CAE, regime de IVA, morada, NISS, IBAN,
  representantes, contactos…), editável pelos dois lados, com histórico de cada
  alteração; e o logótipo (WebP), usado no portal e em todos os documentos
  gerados (balancetes, extratos, comprovativos de entrega, PDF e Excel).
- **Alertas** do contabilista em cima de cada ecrã, até serem lidos.
- Várias empresas por cliente: a lista fica sempre no topo do menu, com o
  logótipo e o NIF, e a entrada volta à última empresa aberta.
- **Uma só sessão** em irs., portal. e gestao.rr-contabilidade.com (cookies do
  domínio partilhado, `lib/cookies-partilhados.ts`, igual nas três apps), com
  botão para passar entre o IRS e o portal Empresas sem nova entrada.

O contabilista define, na Gestão, o mês de início do acompanhamento (não há
meses antes dele), os meses com o envio bloqueado e os meses fechados com a
informação completa.

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
`trial_balance_period` e `account_statement`. As respostas ficam 30 dias na
cache de dados do Next (`unstable_cache`), fora da base; a chave leva a data de
corte e a versão Cegid da empresa (`companies.cegid_versao`), que a Gestão sobe
ao mudar a data de corte ou as credenciais, ou a pedido. As falhas não ficam
guardadas.

## Acessos

Os utilizadores são criados pelo contabilista na Gestão (não há registo). Para
entrar aqui é preciso o acesso **Empresas** (`definir_acessos`) e estar associado
à empresa em `company_users`. A mesma conta serve o IRS. O contabilista vê todas
as empresas, como o cliente as vê.

## Base de dados

Migrações `gestao-clientes/supabase/migrations/202610300060_portal_empresas.sql`
e `202610300061_empresas_completo.sql` (fonte de verdade das três
plataformas), com testes em `gestao-clientes/tests/empresas.test.mjs`.

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
