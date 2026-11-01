'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signInError } from './auth-errors';
import { supabase, siteUrl } from './supabase';
import { senhaComprometida, AVISO_SENHA_COMPROMETIDA } from './password-leak';
import { erroDaPalavraPasse } from './palavra-passe';

const text = (form: FormData, name: string) => String(form.get(name) || '').trim();
function error(message: string, path = '/entrar'): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

export async function signIn(form: FormData) {
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') || '');
  if (!email || !password) error('Preencha o email e a palavra-passe.');
  const client = await supabase();
  const { data: auth, error: failure } = await client.auth.signInWithPassword({ email, password });
  if (failure || !auth.user) error(signInError(failure?.code));
  // Volta ao que o visitante tentou abrir, desde que seja um caminho desta
  // aplicação: '//exemplo.pt' sairia daqui para fora.
  const pedido = text(form, 'destino');
  const interno = /^\/(?![\/\\])[^\\\s]*$/.test(pedido) ? pedido : '';
  (await cookies()).set('rr_chegada', '1', {
    maxAge: 30, path: '/', sameSite: 'lax', httpOnly: false, secure: process.env.NODE_ENV === 'production',
  });
  redirect(interno || '/app');
}

export async function signOut() {
  const client = await supabase();
  // Só esta sessão: sair aqui não desliga o telemóvel nem outro browser.
  await client.auth.signOut({ scope: 'local' });
  redirect('/entrar');
}

export async function recover(form: FormData) {
  if (process.env.AUTH_EMAIL_BRANDING_READY !== 'true') {
    error('A recuperação por email está temporariamente indisponível. Contacte o contabilista.', '/recuperar');
  }
  const origin = siteUrl();
  if (!origin) error('Falta configurar o endereço público da aplicação.', '/recuperar');
  const client = await supabase();
  await client.auth.resetPasswordForEmail(text(form, 'email'), { redirectTo: `${origin}/auth/callback?next=/nova-password` });
  redirect('/entrar?mensagem=Se%20existir%20uma%20conta%20associada,%20receber%C3%A1%20instru%C3%A7%C3%B5es%20para%20recuperar%20o%20acesso.');
}

export async function changePassword(form: FormData) {
  const password = String(form.get('password') || '');
  const fraca = erroDaPalavraPasse(password, String(form.get('confirmation') ?? password));
  if (fraca) error(fraca, '/nova-password');
  if (await senhaComprometida(password)) error(AVISO_SENHA_COMPROMETIDA, '/nova-password');
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) error('Abra uma ligação de recuperação válida.');
  const { error: failure } = await client.auth.updateUser({ password });
  if (failure) error('Não foi possível alterar a palavra-passe.', '/nova-password');
  redirect('/app');
}
