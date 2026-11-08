'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import e from './portal.module.css';

export type OpcaoEmpresa = { id: string; nome: string; nif: string; marca: React.ReactNode; pessoal: boolean };

/* A empresa em que se está, sempre numa só linha; as outras abrem-se quando se
   quer mudar, com procura quando são muitas. Mantém a secção aberta. */
export function SeletorEmpresa({ atual, opcoes, variante = 'lateral' }: { atual: string; opcoes: OpcaoEmpresa[]; variante?: 'lateral' | 'topo' }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [posicao, setPosicao] = useState<React.CSSProperties>({});
  const botao = useRef<HTMLButtonElement>(null);
  const procura = useRef<HTMLInputElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const caminho = usePathname();
  const router = useRouter();

  const empresa = opcoes.find((o) => o.id === atual) ?? opcoes[0];
  const comProcura = opcoes.length > 5;
  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return t ? opcoes.filter((o) => o.nome.toLowerCase().includes(t) || o.nif.includes(t)) : opcoes;
  }, [opcoes, termo]);

  const destino = (o: OpcaoEmpresa) => {
    const seccao = caminho.split('/')[3] || '';
    if (!seccao || (seccao === 'pessoal' && !o.pessoal)) return `/app/${o.id}`;
    return `/app/${o.id}/${seccao}`;
  };

  const abrir = () => {
    const r = botao.current?.getBoundingClientRect();
    if (r) setPosicao({ insetInlineStart: r.left, insetBlockStart: r.bottom + 6, inlineSize: Math.max(r.width, 300) });
    setTermo('');
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.id === atual)));
    setAberto(true);
  };
  const fechar = (voltar = true) => { setAberto(false); if (voltar) botao.current?.focus(); };

  useEffect(() => { setAberto(false); }, [caminho]);
  useEffect(() => {
    if (!aberto) return;
    if (comProcura) procura.current?.focus(); else painel.current?.focus();
  }, [aberto, comProcura]);
  useEffect(() => {
    if (aberto) painel.current?.querySelector('[data-ativo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [aberto, ativo]);

  const teclas = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); fechar(); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); setAtivo((a) => Math.min(a + 1, visiveis.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (ev.key === 'Enter' && visiveis[ativo]) { ev.preventDefault(); fechar(false); router.push(destino(visiveis[ativo])); }
  };

  const conteudo = <>{empresa.marca}<span><strong>{empresa.nome}</strong><small>NIF {empresa.nif}</small></span></>;

  if (opcoes.length < 2) return <div className={e.seletor} data-variante={variante}><div className={e.seletorBotao}>{conteudo}</div></div>;

  return (
    <div className={e.seletor} data-variante={variante}>
      <button ref={botao} type="button" className={e.seletorBotao} aria-haspopup="listbox" aria-expanded={aberto} aria-label={`Empresa atual: ${empresa.nome}. Mudar de empresa`}
              onClick={() => (aberto ? fechar() : abrir())}>
        {conteudo}
        <svg className={e.seletorSetas} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 9 4-4 4 4M8 15l4 4 4-4" /></svg>
      </button>
      {aberto && (
        <>
          <button type="button" className={e.seletorVeu} aria-label="Fechar" tabIndex={-1} onClick={() => fechar()} />
          <div ref={painel} className={e.seletorPainel} style={posicao} tabIndex={-1} onKeyDown={teclas}>
            {comProcura && (
              <input ref={procura} type="search" className={`entrada ${e.seletorProcura}`} placeholder="Procurar por nome ou NIF…" aria-label="Procurar empresa"
                     value={termo} onChange={(ev) => { setTermo(ev.target.value); setAtivo(0); }} />
            )}
            <ul className={e.seletorLista} role="listbox" aria-label="As suas empresas">
              {visiveis.map((o, i) => (
                <li key={o.id} role="option" aria-selected={o.id === atual}>
                  <Link prefetch={false} href={destino(o)} className={e.seletorOpcao} data-ativo={i === ativo ? 'true' : undefined} onMouseEnter={() => setAtivo(i)} onClick={() => fechar(false)}>
                    {o.marca}
                    <span><strong>{o.nome}</strong><small>NIF {o.nif}</small></span>
                    {o.id === atual && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                  </Link>
                </li>
              ))}
              {visiveis.length === 0 && <li className={e.seletorVazio}>Nenhuma empresa com esse nome ou NIF.</li>}
            </ul>
            <Link prefetch={false} href="/app?escolher=1" className={e.seletorTodas} onClick={() => fechar(false)}>Ver todas as empresas</Link>
          </div>
        </>
      )}
    </div>
  );
}
