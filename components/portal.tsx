import Link from 'next/link';
import { cookies } from 'next/headers';
import { signOut } from '@/lib/auth-actions';
import type { EmpresaDoPortal } from '@/lib/auth';
import { data } from '@/lib/formato';
import { Chegada } from './chegada';
import { Icone } from './icones';
import { Menu, Titulo } from './menu';
import e from './portal.module.css';

type Props = {
  empresa: EmpresaDoPortal;
  empresas: EmpresaDoPortal[];
  nome: string | null;
  gabinete: boolean;
  porLer: number;
  children: React.ReactNode;
};

/* O portal de uma empresa: menu, topo com a data de corte e o conteúdo. */
export async function Portal({ empresa, empresas, nome, gabinete, porLer, children }: Props) {
  const base = `/app/${empresa.id}`;
  const outras = empresas.filter((x) => x.id !== empresa.id);
  const chegada = (await cookies()).get('rr_chegada')?.value === '1';
  return (
    <div className={e.portal}>
      <Chegada ativo={chegada} nome={nome} />
      <aside className={e.lateral}>
        <Link href="/app" className={e.marca} aria-label="RR. — as suas empresas">
          <img src="/rr-branco.svg" alt="" width={259} height={142} />
        </Link>

        {outras.length ? (
          <details className={e.trocar}>
            <summary className={e.empresa}>
              <strong>{empresa.nome}</strong>
              <span>NIF {empresa.nif} · trocar de empresa</span>
              <span className={e.seta} aria-hidden="true">▾</span>
            </summary>
            <div className={e.outras}>
              {outras.map((o) => <Link key={o.id} href={`/app/${o.id}`}>{o.nome}</Link>)}
            </div>
          </details>
        ) : (
          <div className={e.empresa}>
            <strong>{empresa.nome}</strong>
            <span>NIF {empresa.nif}</span>
          </div>
        )}

        <Menu base={base} porLer={porLer} />

        {/* Em baixo, quem trata da contabilidade: saber a quem ligar vale mais
            do que ver o próprio nome. */}
        <div className={e.contabilista}>
          <img src="/ruben-rodrigues.webp" alt="Rúben Meirinho Rodrigues" width={96} height={96} className={e.avatar} />
          <div>
            <strong>Rúben Meirinho Rodrigues</strong>
            <span>Contabilista Certificado · Cédula 145854</span>
          </div>
          <div className={e.contactos}>
            <Link href={`${base}/mensagens`}>Enviar mensagem</Link>
            <a href="mailto:contabilidade.rubenrodrigues@gmail.com">Email</a>
          </div>
        </div>

        <form action={signOut} className={e.sairForm}>
          <button type="submit" className={e.sair}><Icone nome="sair" tamanho={18} /><span>Sair</span></button>
        </form>
      </aside>

      <div className={e.principal}>
        {gabinete && (
          <p className={e.vistaGabinete}>Vista do contabilista: está a ver o portal como o cliente o vê.</p>
        )}
        <header className={e.topo}>
          <Titulo />
          <div className={e.acoesTopo}>
            <span className={e.corte} data-sem={!empresa.data_corte}
                  title="Os saldos e balancetes só podem ser extraídos até esta data, já revista pelo contabilista.">
              <Icone nome="cadeado" tamanho={15} />
              {empresa.data_corte ? `Contabilidade fechada até ${data(empresa.data_corte)}` : 'Data de corte por definir'}
            </span>
            {empresas.length > 1 && <Link href="/app" className={e.botaoTopo}>Empresas</Link>}
            <form action={signOut} className={e.sairTopo}>
              <button type="submit" className={e.botaoTopo}>Sair</button>
            </form>
          </div>
        </header>
        <main id="principal" className={e.painel}>{children}</main>
      </div>
    </div>
  );
}
