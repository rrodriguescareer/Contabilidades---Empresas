'use server';
import { redirect } from 'next/navigation';
import { siteUrl, supabase } from './supabase';

/** Entrar (ou criar conta) com o Google ou a Apple. Volta por
    /auth/callback, que troca o código pela sessão e segue para o segundo
    fator ou para a pergunta «quer ativar?». */
export async function entrarCom(form: FormData) {
  const fornecedor = String(form.get('fornecedor') || '');
  const pedido = String(form.get('destino') || '');
  const destino = /^\/(?![\/\\])[^\\\s]*$/.test(pedido) ? pedido : '/app';
  if (fornecedor !== 'google' && fornecedor !== 'apple') redirect('/entrar');
  const origem = siteUrl();
  if (!origem) redirect('/entrar?erro=' + encodeURIComponent('A entrada com Google ou Apple está indisponível.'));
  const client = await supabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: fornecedor,
    options: { redirectTo: `${origem}/auth/callback?next=${encodeURIComponent(destino)}`, skipBrowserRedirect: true },
  });
  if (error || !data?.url) redirect('/entrar?erro=' + encodeURIComponent('Não foi possível abrir a entrada com ' + (fornecedor === 'google' ? 'o Google.' : 'a Apple.')));
  redirect(data.url);
}
