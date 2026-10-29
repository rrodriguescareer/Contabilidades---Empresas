'use client';
import { useActionState, useEffect, useRef } from 'react';
import { enviarMensagem, type Estado } from '@/lib/acoes';
import p from './paginas.module.css';

/** Escrever ao contabilista. A lista de mensagens desce até à última. */
export function Escrever({ empresa }: { empresa: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, aEnviar] = useActionState<Estado, FormData>(async (anterior, form) => {
    const r = await enviarMensagem(anterior, form);
    if (r?.ok) formulario.current?.reset();
    return r;
  }, null);
  return (
    <form ref={formulario} action={enviar} className={p.escrever}>
      <input type="hidden" name="empresa" value={empresa} />
      <label className="campo">
        <span className="so-leitor">Mensagem</span>
        <textarea name="corpo" className="entrada" required maxLength={5000} rows={2} placeholder="Escreva a sua mensagem…" />
      </label>
      <button className="btn" type="submit" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar'}</button>
      {estado?.erro && <p className="aviso aviso-critico" role="alert" style={{ gridColumn: '1 / -1' }}>{estado.erro}</p>}
    </form>
  );
}

export function DescerAoFim({ alvo }: { alvo: string }) {
  useEffect(() => {
    const el = document.getElementById(alvo);
    if (el) el.scrollTop = el.scrollHeight;
  });
  return null;
}
