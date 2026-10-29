import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configuration } from './lib/public-config';

export async function proxy(request: NextRequest) {
  const config = configuration();
  let response = NextResponse.next({ request });
  if (!config) return response;
  const client = createServerClient(config.url, config.key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (values) => {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  // Renova os cookies. Quem autoriza mesmo é o portal_empresas, que deriva a
  // identidade do token validado, e as políticas de RLS na base de dados.
  const { data } = await client.auth.getSession();

  // Sem sessão, corta aqui, antes de a página começar a ser enviada.
  if (!data.session?.access_token) {
    const entrada = new URL('/entrar', request.url);
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    if (destino && destino !== '/entrar') entrada.searchParams.set('destino', destino);
    const saida = NextResponse.redirect(entrada);
    saida.headers.set('Cache-Control', 'private, no-store');
    return saida;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/app', '/app/:path*', '/nova-password', '/sem-acesso'] };
