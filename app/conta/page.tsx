import Link from 'next/link';
import { identity } from '@/lib/auth';
import { signOut } from '@/lib/auth-actions';
import { Avisos } from '@/components/avisos';
import { DesativarDoisFatores } from '@/components/desativar-dois-fatores';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'A minha conta' };

/* A conta de quem entra no portal Empresas: por agora, a autenticação de
   dois fatores (a mesma do portal do IRS: a sessão é partilhada). */
export default async function Conta({ searchParams }: { searchParams: Promise<{ erro?: string; mensagem?: string }> }) {
  const { client, contexto } = await identity();
  const aviso = await searchParams;
  const { data: fatores } = await client.auth.mfa.listFactors();
  const segundoFator = fatores?.totp?.find((f) => f.status === 'verified');

  return (
    <main id="principal" className="envolve" style={{ paddingBlock: 'var(--e-6) var(--e-8)', display: 'grid', gap: 'var(--e-5)', maxInlineSize: '46rem' }}>
      <div className="linha-entre">
        <Link href="/app" className="btn btn-discreto btn-sm">← Voltar ao portal</Link>
        <form action={signOut}><button className="btn btn-secundario btn-sm" type="submit">Sair</button></form>
      </div>
      <div className="pilha pilha-2">
        <h1>A minha conta</h1>
        <p className="suave">{contexto.nome ? `${contexto.nome} · ` : ''}{contexto.email}</p>
      </div>
      <Avisos erro={aviso.erro} mensagem={aviso.mensagem} />

      <section className="cartao pilha pilha-4">
        <h2>Autenticação de dois fatores</h2>
        {segundoFator ? (
          <>
            <p className="aviso aviso-positivo">
              Ativa desde {new Date(segundoFator.created_at).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'long' })}.
              Cada entrada (aqui e no portal do IRS) pede o código da aplicação de autenticação.
            </p>
            <DesativarDoisFatores />
          </>
        ) : (
          <>
            <p className="pequeno">
              Proteja a conta com um código do telemóvel, além da palavra-passe. Usa uma aplicação gratuita (Google
              Authenticator, Microsoft Authenticator ou as Palavras-passe do iPhone) e demora um minuto.
            </p>
            <div><Link className="btn" href="/seguranca/ativar?destino=/conta">Ativar</Link></div>
          </>
        )}
      </section>
    </main>
  );
}
