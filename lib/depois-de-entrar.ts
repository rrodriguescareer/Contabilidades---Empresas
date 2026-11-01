import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/* Para onde vai quem acabou de entrar (palavra-passe, Google, Apple):
   com o segundo fator ativo, primeiro o código; sem ele, a pergunta «quer
   ativar?», a não ser que a tenha dispensado; depois, o destino. */
export async function depoisDeEntrar(client: SupabaseClient, destino: string) {
  const { data: fatores } = await client.auth.mfa.listFactors();
  const comSegundoFator = Boolean(fatores?.totp?.some((f) => f.status === 'verified'));
  const seguir = encodeURIComponent(destino);
  if (comSegundoFator) return `/verificar?destino=${seguir}`;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return destino;
  const { data: perfil } = await client.from('profiles').select('mfa_nao_perguntar').eq('id', user.id).maybeSingle();
  return perfil?.mfa_nao_perguntar ? destino : `/seguranca?destino=${seguir}`;
}
