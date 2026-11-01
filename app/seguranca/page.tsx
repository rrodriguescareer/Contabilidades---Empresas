import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Submeter } from '@/components/forms';
import { EcraAutenticacao } from '@/lib/auth-view';
import { naoAtivarAgora } from '@/lib/dois-fatores';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Proteger a conta' };

/** A pergunta depois da entrada: quer ativar a autenticação de dois fatores? */
export default async function Seguranca({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const { destino } = await searchParams;
  const seguir = destino && /^\/(?![\/\\])[^\\\s]*$/.test(destino) ? destino : '/app';
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');

  return (
    <EcraAutenticacao
      titulo="Quer proteger melhor a sua conta?"
      descricao="Com a autenticação de dois fatores, entrar pede também um código que só o seu telemóvel tem. Mesmo que alguém descubra a palavra-passe, não entra."
    >
      <div className="pilha pilha-4">
        <ul className="lista-simples">
          <li>Usa uma aplicação gratuita: Google Authenticator, Microsoft Authenticator ou as Palavras-passe do iPhone.</li>
          <li>Demora um minuto a ativar.</li>
          <li>Pode desativá-la quando quiser em «A minha conta», com um código enviado por email. Vale também para o portal do IRS.</li>
        </ul>
        <Link className="btn btn-bloco" href={`/seguranca/ativar?destino=${encodeURIComponent(seguir)}`}>Ativar agora</Link>
        <form action={naoAtivarAgora} className="pilha pilha-3">
          <input type="hidden" name="destino" value={seguir} />
          <label className="caixa">
            <input type="checkbox" name="nunca" />
            <span className="pequeno">Não voltar a perguntar</span>
          </label>
          <Submeter className="btn btn-secundario btn-bloco" aDecorrer="…">Agora não</Submeter>
        </form>
      </div>
    </EcraAutenticacao>
  );
}
