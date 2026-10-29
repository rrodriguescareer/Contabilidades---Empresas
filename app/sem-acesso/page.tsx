import { redirect } from 'next/navigation';
import { identity } from '@/lib/auth';
import { signOut } from '@/lib/auth-actions';
import { EcraAutenticacao } from '@/lib/auth-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sem acesso' };

export default async function SemAcesso() {
  const { contexto } = await identity();
  if (contexto.acesso_empresas) redirect('/app');
  const irs = (process.env.NEXT_PUBLIC_IRS_URL || 'https://irs.rr-contabilidade.com').replace(/\/$/, '');
  return (
    <EcraAutenticacao
      titulo="Esta conta não tem o portal Empresas."
      descricao={`Entrou como ${contexto.email}. O acesso às empresas é ativado pelo contabilista.`}
    >
      <div className="pilha pilha-3">
        {contexto.acesso_irs && (
          <a className="btn btn-bloco" href={`${irs}/app`}>Ir para o portal IRS</a>
        )}
        <a className="btn btn-secundario btn-bloco" href="mailto:contabilidade.rubenrodrigues@gmail.com?subject=Acesso%20ao%20portal%20Empresas">
          Pedir acesso ao contabilista
        </a>
        <form action={signOut}>
          <button className="btn btn-discreto btn-bloco" type="submit">Sair</button>
        </form>
      </div>
    </EcraAutenticacao>
  );
}
