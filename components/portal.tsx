import Link from 'next/link';
import { cookies } from 'next/headers';
import { signOut } from '@/lib/auth-actions';
import type { EmpresaDoPortal } from '@/lib/auth';
import { data } from '@/lib/formato';
import { Chegada } from './chegada';
import { Icone } from './icones';
import { Menu, Titulo } from './menu';
import { logotipoUrl } from './secoes';
import { TrocarPortal } from './trocar-portal';
import e from './portal.module.css';

type Props = {
  empresa: EmpresaDoPortal;
  empresas: EmpresaDoPortal[];
  nome: string | null;
  gabinete: boolean;
  porLer: number;
  porPagar: number;
  irs: boolean;
  novidades: Record<string, number>;
  alertas: React.ReactNode;
  children: React.ReactNode;
};

const IRS = (process.env.NEXT_PUBLIC_IRS_URL || 'https://irs.rr-contabilidade.com').replace(/\/$/, '');

/** O logótipo da empresa, ou as iniciais quando ainda não há. */
export function Marca({ empresa, tamanho = 'normal' }: { empresa: EmpresaDoPortal; tamanho?: 'normal' | 'grande' }) {
  const url = logotipoUrl(empresa);
  const iniciais = empresa.nome.split(/\s+/).filter((p) => /^[A-Za-zÀ-ÿ]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return url
    ? <img className={e.logo} data-tamanho={tamanho} src={url} alt="" width={120} height={48} />
    : <span className={e.iniciais} data-tamanho={tamanho} aria-hidden="true">{iniciais || 'E'}</span>;
}

/* O portal de uma empresa: as empresas sempre à vista no topo do menu, as
   secções, o contabilista; em cima, a data de corte e os alertas. */
export async function Portal({ empresa, empresas, nome, gabinete, porLer, porPagar, irs, novidades, alertas, children }: Props) {
  const base = `/app/${empresa.id}`;
  const chegada = (await cookies()).get('rr_chegada')?.value === '1';
  return (
    <div className={e.portal}>
      <Chegada ativo={chegada} nome={nome} />
      <aside className={e.lateral}>
        <Link prefetch={false} href="/app?escolher=1" className={e.marca} aria-label="RR. — as suas empresas">
          <img src="/rr-branco.svg" alt="" width={259} height={142} />
        </Link>

        <nav className={e.empresas} aria-label="Empresas">
          {empresas.map((x) => (
            <Link prefetch={false} key={x.id} href={`/app/${x.id}`} className={e.empresa} aria-current={x.id === empresa.id ? 'true' : undefined}>
              <Marca empresa={x} />
              <span>
                <strong>{x.nome}</strong>
                <small>NIF {x.nif}</small>
              </span>
            </Link>
          ))}
        </nav>

        <Menu base={base} porLer={porLer} porPagar={porPagar} novidades={novidades} ocultar={empresa.tem_trabalhadores ? [] : ['pessoal']} />

        <div className={e.contabilista}>
          <img src="/ruben-rodrigues.webp" alt="Rúben Meirinho Rodrigues" width={96} height={96} className={e.avatar} />
          <div>
            <strong>Rúben Meirinho Rodrigues</strong>
            <span>Contabilista Certificado · Cédula 145854</span>
          </div>
          <div className={e.contactos}>
            <Link prefetch={false} href={`${base}/mensagens`}>Enviar mensagem</Link>
            <a href="mailto:contabilidade.rubenrodrigues@gmail.com">Email</a>
          </div>
        </div>

        {irs && <TrocarPortal url={`${IRS}/app`} nome="Portal IRS" className={e.outroPortal} icone />}
        <form action={signOut} className={e.sairForm}>
          <button type="submit" className={e.sair}><Icone nome="sair" tamanho={18} /><span>Sair</span></button>
        </form>
      </aside>

      <div className={e.principal}>
        {gabinete && <p className={e.vistaGabinete}>Vista do contabilista: está a ver o portal como o cliente o vê.</p>}
        <header className={e.topo}>
          <div className={e.topoEmpresa}>
            <Marca empresa={empresa} tamanho="grande" />
            <Titulo />
          </div>
          <div className={e.acoesTopo}>
            <span className={e.corte} data-sem={!empresa.data_corte}
                  title="Os saldos e balancetes só podem ser extraídos até esta data, já revista pelo contabilista.">
              <Icone nome="cadeado" tamanho={15} />
              {empresa.data_corte ? `Contabilidade fechada até ${data(empresa.data_corte)}` : 'Data de corte por definir'}
            </span>
            {empresas.length > 1 && <Link prefetch={false} href="/app?escolher=1" className={`${e.botaoTopo} ${e.soTelemovel}`}>Trocar de empresa</Link>}
            {irs && <TrocarPortal url={`${IRS}/app`} nome="Portal IRS" className={`${e.botaoTopo} ${e.soTelemovel}`} />}
            <Link prefetch={false} href="/conta" className={e.botaoTopo}>A minha conta</Link>
            <form action={signOut} className={e.sairTopo}>
              <button type="submit" className={e.botaoTopo}>Sair</button>
            </form>
          </div>
        </header>
        <main id="principal" className={e.painel}>
          {alertas}
          {children}
        </main>
      </div>
    </div>
  );
}
