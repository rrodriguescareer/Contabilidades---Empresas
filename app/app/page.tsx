import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { session } from '@/lib/auth';
import { signOut } from '@/lib/auth-actions';
import { data } from '@/lib/formato';
import { Marca } from '@/components/portal';
import { TrocarPortal } from '@/components/trocar-portal';

const IRS = (process.env.NEXT_PUBLIC_IRS_URL || 'https://irs.rr-contabilidade.com').replace(/\/$/, '');
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'As suas empresas' };

/* A entrada: com uma empresa, vai-se direto a ela; com várias, escolhe-se. */
export default async function Empresas({ searchParams }: { searchParams: Promise<{ escolher?: string }> }) {
  const { contexto } = await session();
  const { escolher } = await searchParams;
  if (!escolher) {
    // Volta à última empresa aberta (o proxy guarda-a num cookie).
    const ultima = (await cookies()).get('rr_empresa')?.value;
    if (ultima && contexto.empresas.some((e) => e.id === ultima)) redirect(`/app/${ultima}`);
    if (contexto.empresas.length === 1 && !contexto.is_staff) redirect(`/app/${contexto.empresas[0].id}`);
  }
  const primeiro = (contexto.nome || '').split(/\s+/)[0];
  return (
    <main id="principal" className="envolve" style={{ paddingBlock: 'var(--e-7)', display: 'grid', gap: 'var(--e-6)' }}>
      <div className="linha-entre">
        <img src="/rr.svg" alt="RR." width={259} height={142} style={{ height: 30, width: 'auto' }} />
        <div className="linha">
          {contexto.acesso_irs && <TrocarPortal url={`${IRS}/app`} nome="Portal IRS" className="btn btn-secundario btn-sm" />}
          <form action={signOut}><button className="btn btn-secundario btn-sm" type="submit">Sair</button></form>
        </div>
      </div>
      <div className="pilha pilha-2">
        <h1>{primeiro ? `Olá, ${primeiro}.` : 'As suas empresas.'}</h1>
        <p className="suave">
          {contexto.is_staff
            ? 'Vista do contabilista: todas as empresas ativas, como os clientes as veem.'
            : 'Escolha a empresa que quer consultar.'}
        </p>
      </div>
      {contexto.empresas.length === 0 ? (
        <div className="vazio">
          <strong>Ainda sem empresas associadas</strong>
          <p>O contabilista associa a sua conta às empresas que acompanha. Se acha que falta alguma, envie-lhe um email.</p>
          <a className="btn" href="mailto:contabilidade.rubenrodrigues@gmail.com">Escrever ao contabilista</a>
        </div>
      ) : (
        <div className={p.empresas}>
          {contexto.empresas.map((e) => (
            <Link key={e.id} href={`/app/${e.id}`} className={p.empresaCartao}>
              <Marca empresa={e} tamanho="grande" />
              <strong>{e.nome}</strong>
              <span>NIF {e.nif}</span>
              <span>{e.data_corte ? `Contabilidade fechada até ${data(e.data_corte)}` : 'Data de corte por definir'}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
