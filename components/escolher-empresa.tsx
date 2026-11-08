'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import p from './paginas.module.css';

export type CartaoEmpresa = { id: string; nome: string; nif: string; corte: string; marca: React.ReactNode };

/* A escolha de empresa: cartões iguais, e procura quando são muitas. */
export function EscolherEmpresa({ empresas }: { empresas: CartaoEmpresa[] }) {
  const [termo, setTermo] = useState('');
  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return t ? empresas.filter((e) => e.nome.toLowerCase().includes(t) || e.nif.includes(t)) : empresas;
  }, [empresas, termo]);
  return (
    <div className="pilha pilha-4">
      {empresas.length > 6 && (
        <input type="search" className="entrada" style={{ maxInlineSize: '26rem' }} placeholder="Procurar por nome ou NIF…" aria-label="Procurar empresa" value={termo} onChange={(ev) => setTermo(ev.target.value)} />
      )}
      {visiveis.length === 0 ? (
        <p className="suave">Nenhuma empresa com esse nome ou NIF.</p>
      ) : (
        <div className={p.empresas}>
          {visiveis.map((e) => (
            <Link prefetch={false} key={e.id} href={`/app/${e.id}`} className={p.empresaCartao}>
              <span className={p.empresaMarca}>{e.marca}</span>
              <span className={p.empresaTexto}>
                <strong>{e.nome}</strong>
                <span>NIF {e.nif}</span>
                <small>{e.corte}</small>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
