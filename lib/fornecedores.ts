import 'server-only';
import { configuration } from './supabase';

/* Os fornecedores de entrada (Google, Apple) ligados no Supabase. Os botões
   «Continuar com» só aparecem para os que estão ativos: ligar um no painel do
   Supabase basta para o botão surgir, em poucos minutos. */
export type Fornecedor = 'google' | 'apple';

export async function fornecedoresAtivos(): Promise<Fornecedor[]> {
  const config = configuration();
  if (!config) return [];
  try {
    const r = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.key }, next: { revalidate: 300 } });
    if (!r.ok) return [];
    const d = (await r.json()) as { external?: Record<string, boolean> };
    return (['google', 'apple'] as const).filter((f) => d.external?.[f]);
  } catch {
    return [];
  }
}
