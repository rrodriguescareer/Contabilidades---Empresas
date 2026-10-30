'use client';
import { useActionState, useRef } from 'react';

type Estado = { ok?: string; erro?: string } | null;

/** Um formulário que corre uma ação do servidor e mostra o resultado por
    baixo do botão. Com `limpar`, esvazia os campos quando corre bem. */
export function FormAcao({ acao, children, botao, aDecorrer = 'A guardar…', limpar = false, className, botaoClasse = 'btn' }: {
  acao: (anterior: Estado, form: FormData) => Promise<Estado>;
  children: React.ReactNode;
  botao: string;
  aDecorrer?: string;
  limpar?: boolean;
  className?: string;
  botaoClasse?: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, aCorrer] = useActionState<Estado, FormData>(async (anterior, form) => {
    const r = await acao(anterior, form);
    if (r?.ok && limpar) formulario.current?.reset();
    return r;
  }, null);
  return (
    <form ref={formulario} action={enviar} className={className}>
      {children}
      {estado?.erro && <p className="aviso aviso-critico" role="alert">{estado.erro}</p>}
      {estado?.ok && <p className="aviso aviso-positivo" role="status">{estado.ok}</p>}
      <div><button className={botaoClasse} type="submit" disabled={aCorrer}>{aCorrer ? aDecorrer : botao}</button></div>
    </form>
  );
}
