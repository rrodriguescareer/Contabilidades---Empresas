import { redirect } from 'next/navigation';
import { Submeter } from '@/components/forms';
import { EcraAutenticacao } from '@/lib/auth-view';
import { signOut } from '@/lib/auth-actions';
import { verificarSegundoFator } from '@/lib/dois-fatores';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Código de verificação' };

/** O segundo fator: o código da aplicação de autenticação. */
export default async function Verificar({ searchParams }: { searchParams: Promise<{ erro?: string; destino?: string }> }) {
  const { erro, destino } = await searchParams;
  const seguir = destino && /^\/(?![\/\\])[^\\\s]*$/.test(destino) ? destino : '/app';
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: nivel } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.currentLevel === 'aal2' || nivel?.nextLevel !== 'aal2') redirect(seguir);

  return (
    <EcraAutenticacao
      titulo="Introduza o código."
      descricao="Abra a aplicação de autenticação e escreva o código de 6 algarismos que aparece para a RR Contabilidade."
      erro={erro}
      rodape={
        <>
          <span className="pequeno suave">Perdeu o acesso à aplicação? Escreva ao contabilista: <a href="mailto:contabilidade.rubenrodrigues@gmail.com">contabilidade.rubenrodrigues@gmail.com</a></span>
          <form action={signOut}><button className="btn-texto" type="submit">Sair</button></form>
        </>
      }
    >
      <form action={verificarSegundoFator} className="pilha pilha-4">
        <input type="hidden" name="destino" value={seguir} />
        <label className="campo">
          <span>Código</span>
          <input name="codigo" className="entrada" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}"
                 maxLength={7} required autoFocus placeholder="000 000" style={{ fontSize: '1.4rem', letterSpacing: '.3em', textAlign: 'center' }} />
        </label>
        <Submeter>Confirmar</Submeter>
      </form>
    </EcraAutenticacao>
  );
}
