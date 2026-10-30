'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { carregar, preparar, type Pronto } from '@/lib/carregar';
import type { Anuncio, Concluido, Estado, Lugar } from '@/lib/envios';
import { tamanho } from '@/lib/formato';
import p from './paginas.module.css';

/* Escolher ficheiros e enviá-los diretamente para o Storage, com o progresso
   de cada um. Serve os documentos do mês, os anexos do pessoal e os
   comprovativos. */

type EstadoItem = 'escolhido' | 'a otimizar' | 'a enviar' | 'enviado' | 'erro';
export type Item = { chave: string; ficheiro: File; estado: EstadoItem; progresso: number; erro?: string; tamanhoFinal?: number };

let contador = 0;

export function useFicheiros(maximo: number) {
  const [itens, setItens] = useState<Item[]>([]);
  const juntar = useCallback((lista: FileList | File[] | null) => {
    const novos = Array.from(lista ?? []).filter((f) => f.size > 0)
      .map((ficheiro): Item => ({ chave: `f${++contador}`, ficheiro, estado: 'escolhido', progresso: 0 }));
    // Os que já foram enviados saem quando se escolhem outros.
    setItens((atuais) => [...atuais.filter((i) => i.estado !== 'enviado'), ...novos].slice(0, maximo));
  }, [maximo]);
  const tirar = useCallback((chave: string) => setItens((a) => a.filter((i) => i.chave !== chave)), []);
  const mudar = useCallback((chave: string, m: Partial<Item>) => setItens((a) => a.map((i) => (i.chave === chave ? { ...i, ...m } : i))), []);
  const esvaziar = useCallback(() => setItens([]), []);
  return { itens, juntar, tirar, mudar, esvaziar, maximo };
}
type Ficheiros = ReturnType<typeof useFicheiros>;

/** O envio completo: otimizar no browser, registar no servidor, carregar para
    o Storage e concluir. Devolve a mensagem final para mostrar. */
export async function enviarTodos(
  f: Ficheiros,
  registar: (anuncios: Anuncio[]) => Promise<{ erro: string } | { lugares: Lugar[] }>,
  concluir: (ids: string[], falhados: string[]) => Promise<Concluido>,
): Promise<Estado> {
  const lista = f.itens.filter((i) => i.estado !== 'enviado');
  if (!lista.length) return { erro: 'Escolha pelo menos um ficheiro.' };

  const prontos: { item: Item; pronto: Pronto }[] = [];
  const locais: string[] = [];
  for (const item of lista) {
    f.mudar(item.chave, { estado: 'a otimizar', progresso: 0, erro: undefined });
    const r = await preparar(item.ficheiro);
    if ('erro' in r) {
      f.mudar(item.chave, { estado: 'erro', erro: r.erro });
      locais.push(`${item.ficheiro.name}: ${r.erro}`);
    } else {
      prontos.push({ item, pronto: r });
      f.mudar(item.chave, { tamanhoFinal: r.blob.size });
    }
  }
  if (!prontos.length) return { erro: locais.join(' · ') };

  let registo: Awaited<ReturnType<typeof registar>>;
  try {
    registo = await registar(prontos.map(({ pronto }) => ({ nome: pronto.nome, mime: pronto.mime, tamanho: pronto.blob.size, original: pronto.original })));
  } catch {
    prontos.forEach(({ item }) => f.mudar(item.chave, { estado: 'escolhido' }));
    return { erro: 'Sem ligação ao servidor. Confirme a internet e tente novamente.' };
  }
  if ('erro' in registo) {
    prontos.forEach(({ item }) => f.mudar(item.chave, { estado: 'escolhido' }));
    return { erro: registo.erro };
  }

  const ids: string[] = [];
  const falhados: string[] = [];
  for (let i = 0; i < prontos.length; i++) {
    const { item, pronto } = prontos[i];
    const lugar = registo.lugares[i];
    if (!lugar?.url || !lugar.id) {
      f.mudar(item.chave, { estado: 'erro', erro: lugar?.erro || 'não foi possível preparar o envio' });
      locais.push(`${item.ficheiro.name}: ${lugar?.erro || 'não foi possível preparar o envio'}`);
      continue;
    }
    f.mudar(item.chave, { estado: 'a enviar', progresso: 0 });
    try {
      await carregar(lugar.url, pronto, (x) => f.mudar(item.chave, { progresso: x }));
      ids.push(lugar.id);
      f.mudar(item.chave, { progresso: 1 });
    } catch {
      falhados.push(lugar.id);
      f.mudar(item.chave, { estado: 'erro', erro: 'o envio foi interrompido' });
      locais.push(`${item.ficheiro.name}: o envio foi interrompido`);
    }
  }

  let fim: Concluido;
  try {
    fim = await concluir(ids, falhados);
  } catch {
    return { erro: 'Os ficheiros foram carregados, mas a confirmação falhou. Recarregue a página para ver o que ficou registado.' };
  }
  const recusados = new Set(fim.recusados ?? []);
  for (let i = 0; i < prontos.length; i++) {
    const id = registo.lugares[i]?.id;
    if (!id || falhados.includes(id)) continue;
    f.mudar(prontos[i].item.chave, recusados.has(id) ? { estado: 'erro', erro: 'recusado pelo servidor' } : { estado: 'enviado', progresso: 1 });
  }
  if (!locais.length) return fim.ok ? { ok: fim.ok } : { erro: fim.erro };
  if (fim.ok) return { ok: `${fim.ok} Não foram enviados: ${locais.join(' · ')}.` };
  return { erro: [fim.erro, ...locais].filter(Boolean).join(' · ') };
}

/** Pede confirmação a quem tenta sair da página a meio de um envio. */
export function useAvisarAoSair(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [ativo]);
}

const TEXTO: Record<EstadoItem, string> = {
  escolhido: 'Pronto a enviar', 'a otimizar': 'A otimizar…', 'a enviar': 'A enviar…', enviado: 'Enviado', erro: 'Não enviado',
};

/** A zona de escolha (arrastar, escolher ou fotografar) e a lista. */
export function ZonaFicheiros({ f, ativo, titulo = 'Escolher ficheiros ou fotografar', nota, compacto = false }: {
  f: Ficheiros; ativo: boolean; titulo?: string; nota?: string; compacto?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastar, setArrastar] = useState(false);
  const restam = f.maximo - f.itens.filter((i) => i.estado !== 'enviado').length;
  return (
    <div className={p.envio}>
      <label
        className={p.escolher}
        data-arrastar={arrastar}
        data-compacto={compacto}
        aria-disabled={ativo || restam <= 0}
        onDragOver={(e) => { e.preventDefault(); if (!ativo) setArrastar(true); }}
        onDragLeave={() => setArrastar(false)}
        onDrop={(e) => { e.preventDefault(); setArrastar(false); if (!ativo) f.juntar(e.dataTransfer.files); }}
      >
        <strong>{f.itens.length ? 'Juntar mais ficheiros' : titulo}</strong>
        <span>{nota ?? `PDF, JPEG, PNG ou WebP · até ${f.maximo} de cada vez · as fotografias são otimizadas no próprio telemóvel`}</span>
        <input ref={entrada} type="file" multiple={f.maximo > 1} disabled={ativo || restam <= 0}
               accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
               onChange={(e) => { f.juntar(e.target.files); e.target.value = ''; }} />
      </label>
      {f.itens.length > 0 && (
        <ul className={p.escolhidos} aria-live="polite">
          {f.itens.map((i) => (
            <li key={i.chave} data-estado={i.estado}>
              <div className={p.escolhidoNome}>
                <span>{i.ficheiro.name}</span>
                <small>
                  {i.tamanhoFinal && i.tamanhoFinal < i.ficheiro.size ? `${tamanho(i.ficheiro.size)} → ${tamanho(i.tamanhoFinal)}` : tamanho(i.ficheiro.size)}
                  {' · '}{i.estado === 'erro' && i.erro ? i.erro : i.estado === 'a enviar' ? `A enviar… ${Math.round(i.progresso * 100)}%` : TEXTO[i.estado]}
                </small>
                {(i.estado === 'a enviar' || i.estado === 'enviado') && (
                  <span className={p.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(i.progresso * 100)}>
                    <span style={{ inlineSize: `${Math.round(i.progresso * 100)}%` }} />
                  </span>
                )}
              </div>
              {!ativo && i.estado !== 'enviado' && (
                <button type="button" className="btn-texto" onClick={() => f.tirar(i.chave)} aria-label={`Retirar ${i.ficheiro.name}`}>Retirar</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
