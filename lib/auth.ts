import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { configuration, supabase } from './supabase';

const erro = (mensagem: string) => `/entrar?erro=${encodeURIComponent(mensagem)}`;

export type EmpresaDoPortal = {
  id: string; nome: string; nif: string; data_corte: string | null; tem_cegid: boolean;
  inicio: string | null; logotipo: string | null; logotipo_em: string | null; cegid_versao: number; tem_trabalhadores: boolean;
};
export type Contexto = {
  id: string;
  email: string;
  nome: string | null;
  is_staff: boolean;
  ativo: boolean;
  acesso_empresas: boolean;
  acesso_irs: boolean;
  empresas: EmpresaDoPortal[];
};

/** Quem está autenticado e que empresas vê, numa só ida à base. O
    portal_empresas deriva tudo de auth.uid(): o cookie só transporta o token,
    que o PostgREST valida. */
export const identity = cache(async function identity() {
  if (!configuration()) redirect('/entrar');
  const client = await supabase();
  const { data: guardado, error } = await client.auth.getSession();
  if (error || !guardado.session?.access_token) redirect('/entrar');

  const { data, error: falha } = await client.rpc('portal_empresas');
  if (falha || !data?.id) redirect(erro('Não foi possível carregar a conta.'));
  const contexto = data as Contexto;
  if (!contexto.ativo) redirect(erro('Acesso bloqueado ou email por confirmar. Contacte o contabilista.'));
  return { client, user: { id: contexto.id, email: contexto.email }, contexto };
});

/** A área do portal: exige o acesso Empresas. */
export const session = cache(async function session() {
  const atual = await identity();
  if (!atual.contexto.acesso_empresas) redirect('/sem-acesso');
  return atual;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A empresa pedida no endereço, só se esta pessoa a puder ver. A base volta
    a verificar em cada leitura; isto só evita desenhar um ecrã alheio. */
export const empresaDaSessao = cache(async function empresaDaSessao(id: string) {
  const atual = await session();
  const empresa = UUID.test(id) ? atual.contexto.empresas.find((e) => e.id === id) : undefined;
  if (!empresa) notFound();
  return { ...atual, empresa };
});
