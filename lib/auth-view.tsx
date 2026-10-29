import Link from 'next/link';
import { configuration } from './supabase';
import a from './auth-view.module.css';

type Props = {
  children: React.ReactNode;
  titulo: string;
  descricao: string;
  mensagem?: string;
  erro?: string;
  /** Ligações por baixo do formulário. */
  rodape?: React.ReactNode;
};

/* Ecrã partilhado por entrar, registar, recuperar e definir palavra-passe.
   À esquerda a marca, à direita o formulário; no telemóvel só o formulário. */
export function EcraAutenticacao({ children, titulo, descricao, mensagem, erro, rodape }: Props) {
  const pronto = Boolean(configuration());

  return (
    <main id="principal" className={a.ecra}>
      <section className={a.marca} aria-hidden="true">
        <img src="/rr-branco.svg" alt="" width={259} height={142} />
        <div className={a.marcaTexto}>
          <h2>A contabilidade da sua empresa, à mão.</h2>
          <p>
            Balancetes fechados, saldos, clientes, fornecedores e bancos. E os documentos do mês entregues
            num só sítio, até ao dia 10.
          </p>
        </div>
        <small>Rúben Meirinho Rodrigues · Contabilista Certificado n.º 145854</small>
      </section>

      <section className={a.coluna}>
        <div className={a.cartao}>
          <Link href="/" className={a.logo}>
            <img src="/rr.svg" alt="RR." width={259} height={142} />
          </Link>

          <div className="pilha pilha-2">
            <h1>{titulo}</h1>
            <p className="suave">{descricao}</p>
          </div>

          {erro && (
            <p className="aviso aviso-critico" role="alert">
              {erro}
            </p>
          )}
          {mensagem && (
            <p className="aviso aviso-positivo" role="status">
              {mensagem}
            </p>
          )}

          {pronto ? (
            children
          ) : (
            <div className="aviso aviso-critico pilha pilha-2" role="alert">
              <strong>Serviço temporariamente indisponível</strong>
              <p>Não foi possível estabelecer ligação. Tente mais tarde ou contacte-me por email.</p>
              <a href="mailto:contabilidade.rubenrodrigues@gmail.com">contabilidade.rubenrodrigues@gmail.com</a>
            </div>
          )}

          {rodape && <div className={a.ligacoes}>{rodape}</div>}

          <div className={a.legal}>
            <span>Portal Empresas · acesso criado pelo contabilista</span>
          </div>
        </div>
      </section>
    </main>
  );
}
