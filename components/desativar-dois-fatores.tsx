'use client';
import { useState, useTransition } from 'react';
import { desativarComCodigo, pedirCodigoDesativar } from '@/lib/dois-fatores';

/** Desativar o segundo fator: primeiro um código por email, depois confirmá-lo. */
export function DesativarDoisFatores({ voltar = '/conta' }: { voltar?: string }) {
  const [pedido, setPedido] = useState<{ ok?: string; erro?: string } | null>(null);
  const [aCorrer, correr] = useTransition();
  return (
    <div className="pilha pilha-3">
      {!pedido?.ok && (
        <button type="button" className="btn btn-secundario" disabled={aCorrer}
                onClick={() => correr(async () => setPedido(await pedirCodigoDesativar()))}>
          {aCorrer ? 'A enviar…' : 'Desativar: enviar código por email'}
        </button>
      )}
      {pedido?.erro && <p className="aviso aviso-critico" role="alert">{pedido.erro}</p>}
      {pedido?.ok && (
        <form action={desativarComCodigo} className="pilha pilha-3">
          <p className="aviso aviso-positivo" role="status">{pedido.ok}</p>
          <input type="hidden" name="voltar" value={voltar} />
          <label className="campo">
            <span>Código do email</span>
            <input name="codigo" className="entrada" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required
                   placeholder="000000" style={{ letterSpacing: '.25em' }} />
          </label>
          <div className="linha">
            <button className="btn btn-critico" type="submit">Desativar a autenticação de dois fatores</button>
            <button type="button" className="btn-texto" onClick={() => correr(async () => setPedido(await pedirCodigoDesativar()))}>Enviar outro código</button>
          </div>
        </form>
      )}
    </div>
  );
}
