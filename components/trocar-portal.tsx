'use client';
import { useRef } from 'react';

/** Passar para o outro portal, com a mesma sessão. Uma confirmação curta,
    para ninguém mudar de portal sem querer. */
export function TrocarPortal({ url, nome, className, icone = false }: { url: string; nome: string; className?: string; icone?: boolean }) {
  const caixa = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => caixa.current?.showModal()}>
        {icone && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" />
          </svg>
        )}
        <span>{nome}</span>
      </button>
      <dialog ref={caixa} className="confirmar-portal" aria-labelledby="confirmar-portal-titulo">
        <h2 id="confirmar-portal-titulo">Mudar para o {nome}?</h2>
        <p>A sessão mantém-se: não precisa de voltar a entrar. Pode regressar a qualquer momento pelo mesmo botão.</p>
        <div className="confirmar-portal-acoes">
          <button type="button" className="btn btn-secundario" onClick={() => caixa.current?.close()}>Ficar aqui</button>
          <a className="btn" href={url}>Mudar para o {nome}</a>
        </div>
      </dialog>
    </>
  );
}
