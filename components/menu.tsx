'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useEffect } from 'react';
import { Icone } from './icones';
import { SECOES } from './secoes';
import e from './portal.module.css';

/** O menu da empresa. O separador atual vem do segmento do endereço. */
export function Menu({ base, porLer, porPagar, novidades = {}, ocultar = [] }: {
  base: string; porLer: number; porPagar: number; novidades?: Record<string, number>; ocultar?: string[];
}) {
  const atual = useSelectedLayoutSegment() ?? '';

  // No telemóvel o menu é uma faixa que desliza: o separador atual fica à vista.
  useEffect(() => {
    if (window.innerWidth > 900) return;
    document.querySelector(`.${e.menu} [aria-current="page"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [atual]);

  return (
    <nav className={e.menu} aria-label="Secções">
      {SECOES.filter((s) => !ocultar.includes(s.segmento)).map((s) => (
        <Link prefetch={false} key={s.segmento} href={s.segmento ? `${base}/${s.segmento}` : base} className={e.item}
              aria-current={atual === s.segmento || (s.segmento === 'contas' && atual === 'extrato') ? 'page' : undefined}>
          <Icone nome={s.icone} />
          <span>{s.nome}</span>
          {s.segmento === 'mensagens' && porLer > 0 && <span className={e.contagem} aria-label={`${porLer} por ler`}>{porLer}</span>}
          {s.segmento === 'impostos' && porPagar > 0 && <span className={e.contagem} aria-label={`${porPagar} por pagar`}>{porPagar}</span>}
          {/* O que mudou desde a última visita; na secção aberta já não conta. */}
          {s.segmento !== atual && (novidades[s.segmento] ?? 0) > 0 && (
            <span className={e.contagem} aria-label={s.segmento === '' ? 'Alertas do contabilista por ler' : `${novidades[s.segmento]} novidades`}>
              {s.segmento === '' ? '!' : novidades[s.segmento]}
            </span>
          )}
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
