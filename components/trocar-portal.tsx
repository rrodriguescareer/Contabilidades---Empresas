'use client';
import { useRef } from 'react';

/** Passar para o outro portal, com a mesma sessão. Uma confirmação curta,
    para ninguém mudar de portal sem querer. */
export function TrocarPortal({ url, nome, className }: { url: string; nome: string; className?: string }) {
  const caixa = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => caixa.current?.showModal()}>{nome}</button>
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
