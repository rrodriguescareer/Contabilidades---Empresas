import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configuration } from './lib/public-config';
import { opcoesDosCookies, partilharCookiesDeSessao } from './lib/cookies-partilhados';

const EMPRESA = /^\/app\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$)/i;

export async function proxy(request: NextRequest) {
  const config = configuration();
  let response = NextResponse.next({ request });
  if (!config) return response;
  const cookieOptions = opcoesDosCookies(request.headers.get('host'));
  const client = createServerClient(config.url, config.key, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Renova os cookies. Quem autoriza mesmo é o portal_empresas, que deriva a
  // identidade do token validado, e as políticas de RLS na base de dados.
  const { data } = await client.auth.getSession();

  // Na entrada: com a sessão de outra plataforma já ativa, segue direto.
  // (Com um erro na entrada — conta bloqueada, sem acesso — fica-se nela.)
  if (request.nextUrl.pathname === '/entrar') {
    if (!data.session?.access_token || request.nextUrl.searchParams.has('erro')) return partilharCookiesDeSessao(request, response);
    const pedido = request.nextUrl.searchParams.get('destino') || '';
    const destino = /^\/(?![\/\\])[^\\\s]*$/.test(pedido) ? pedido : '/app';
    const seguir = NextResponse.redirect(new URL(destino, request.url));
    response.cookies.getAll().forEach((c) => seguir.cookies.set(c));
    return partilharCookiesDeSessao(request, seguir);
  }

  // Sem sessão, corta aqui, antes de a página começar a ser enviada.
  if (!data.session?.access_token) {
    const entrada = new URL('/entrar', request.url);
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    if (destino && destino !== '/entrar') entrada.searchParams.set('destino', destino);
    const saida = NextResponse.redirect(entrada);
    saida.headers.set('Cache-Control', 'private, no-store');
    return saida;
  }

  // A última empresa aberta, para a entrada seguinte ir direta a ela.
  const empresa = EMPRESA.exec(request.nextUrl.pathname)?.[1];
  if (empresa && request.cookies.get('rr_empresa')?.value !== empresa) {
    response.cookies.set('rr_empresa', empresa, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return partilharCookiesDeSessao(request, response);
}

export const config = { matcher: ['/app', '/app/:path*', '/nova-password', '/sem-acesso', '/entrar'] };
