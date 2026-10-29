'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useEffect } from 'react';
import { Icone } from './icones';
import { SECOES } from './secoes';
import e from './portal.module.css';

/** O menu da empresa. O separador atual vem do segmento do endereço. */
export function Menu({ base, porLer }: { base: string; porLer: number }) {
  const atual = useSelectedLayoutSegment() ?? '';

  // No telemóvel o menu é uma faixa que desliza: o separador atual fica à vista.
  useEffect(() => {
    if (window.innerWidth > 900) return;
    document.querySelector(`.${e.menu} [aria-current="page"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [atual]);

  return (
    <nav className={e.menu} aria-label="Secções">
      {SECOES.map((s) => (
        <Link key={s.segmento} href={s.segmento ? `${base}/${s.segmento}` : base} className={e.item}
              aria-current={atual === s.segmento || (s.segmento === 'contas' && atual === 'extrato') ? 'page' : undefined}>
          <Icone nome={s.icone} />
          <span>{s.nome}</span>
          {s.segmento === 'mensagens' && porLer > 0 && <span className={e.contagem} aria-label={`${porLer} por ler`}>{porLer}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** O título do topo, a partir da secção atual. */
export function Titulo() {
  const atual = useSelectedLayoutSegment() ?? '';
  const s = SECOES.find((x) => x.segmento === atual) ?? (atual === 'extrato' ? SECOES.find((x) => x.segmento === 'contas') : null) ?? SECOES[0];
  return (
    <div className={e.tituloTopo}>
      <h1>{atual === 'extrato' ? 'Extrato de conta' : s.nome}</h1>
      <p>{s.nota}</p>
    </div>
  );
}
