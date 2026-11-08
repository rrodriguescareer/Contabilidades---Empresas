'use client';
import { useState } from 'react';
import { carregar, preparar as otimizar, MAXIMO } from '@/lib/carregar';
import type { Anuncio, Concluido, Estado, Lugar } from '@/lib/envios';
import type { PendenciaEntrega } from '@/lib/entrega-servidor';
import { enviarTodos, useAvisarAoSair, useFicheiros, ZonaFicheiros } from './carregador';
import e from './entrega.module.css';

type Preparar = (pendencia: string | null, ficheiros: Anuncio[]) => Promise<{ erro: string } | { lugares: Lugar[] }>;
type Concluir = (ids: string[], falhados: string[]) => Promise<Concluido>;

const TIPOS: Record<string, string> = {
  FT: 'Fatura', FS: 'Fatura simplificada', FR: 'Fatura-recibo', ND: 'Nota de débito', NC: 'Nota de crédito',
  RC: 'Recibo', MB: 'Movimento bancário', EB: 'Extrato bancário', OUTRO: 'Documento',
};
const ACEITA = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
const dataPt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const euros = (c: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions).format(c / 100);

function grupos(lista: PendenciaEntrega[]) {
  return [
    { titulo: 'Faturas em falta', itens: lista.filter((p) => !['EB', 'MB', 'OUTRO'].includes(p.tipo)) },
    { titulo: 'Bancos', itens: lista.filter((p) => ['EB', 'MB'].includes(p.tipo)) },
    { titulo: 'Outros documentos', itens: lista.filter((p) => p.tipo === 'OUTRO') },
  ].filter((g) => g.itens.length);
}

type Fase = 'parado' | 'a otimizar' | 'a enviar' | 'a confirmar' | 'entregue';

/* Cada documento em falta tem o seu botão: escolher o ficheiro já o envia. */
function Linha({ p, preparar, concluir, aoEntregar }: { p: PendenciaEntrega; preparar: Preparar; concluir: Concluir; aoEntregar: () => void }) {
  const [fase, setFase] = useState<Fase>('parado');
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState('');
  const [arrastar, setArrastar] = useState(false);
  useAvisarAoSair(fase === 'a enviar' || fase === 'a otimizar');

  const enviar = async (f?: File) => {
    if (!f || fase !== 'parado') return;
    setErro('');
    setFase('a otimizar');
    try {
      const pronto = await otimizar(f);
      if ('erro' in pronto) { setErro(pronto.erro); setFase('parado'); return; }
      if (pronto.blob.size > MAXIMO) { setErro('tem mais de 10 MB'); setFase('parado'); return; }
      const registo = await preparar(p.id, [{ nome: pronto.nome, mime: pronto.mime, tamanho: pronto.blob.size, original: pronto.original }]);
      if ('erro' in registo) { setErro(registo.erro); setFase('parado'); return; }
      const lugar = registo.lugares[0];
      if (!lugar?.url || !lugar.id) { setErro(lugar?.erro || 'não foi possível preparar o envio'); setFase('parado'); return; }
      setFase('a enviar');
      setProgresso(0);
      try {
        await carregar(lugar.url, pronto, setProgresso);
      } catch {
        await concluir([], [lugar.id]);
        setErro('o envio foi interrompido. Tente novamente.');
        setFase('parado');
        return;
      }
      setFase('a confirmar');
      const fim = await concluir([lugar.id], []);
      if (fim.recusados?.length || !fim.ok) { setErro(fim.erro || 'o documento foi recusado'); setFase('parado'); return; }
      setFase('entregue');
      aoEntregar();
    } catch {
      setErro('sem ligação. Confirme a internet e tente novamente.');
      setFase('parado');
    }
  };

  const nome = [TIPOS[p.tipo] ?? p.tipo, p.numero].filter(Boolean).join(' ');
  const detalhes = [p.data_documento && dataPt(p.data_documento), p.valor_cents != null && euros(p.valor_cents), p.banco].filter(Boolean).join(' · ');

  return (
    <li className={e.linha} data-fase={fase} data-arrastar={arrastar || undefined}
        onDragOver={(ev) => { ev.preventDefault(); if (fase === 'parado') setArrastar(true); }}
        onDragLeave={() => setArrastar(false)}
        onDrop={(ev) => { ev.preventDefault(); setArrastar(false); void enviar(ev.dataTransfer.files[0]); }}>
      <div className={e.linhaTexto}>
        <strong>{p.descricao}</strong>
        <span>{nome}{detalhes ? ` · ${detalhes}` : ''}</span>
        {erro && <span className={e.erro} role="alert">Não foi enviado: {erro}</span>}
        {fase === 'a enviar' && <span className={e.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progresso * 100)}><i style={{ inlineSize: `${Math.round(progresso * 100)}%` }} /></span>}
      </div>
      {fase === 'entregue' ? (
        <span className="etiqueta etiqueta-positivo">Entregue</span>
      ) : fase === 'parado' ? (
        <label className={`btn btn-secundario btn-sm ${e.escolher}`}>
          Juntar documento
          <input type="file" accept={ACEITA} className="so-leitor" onChange={(ev) => { void enviar(ev.target.files?.[0]); ev.target.value = ''; }} aria-label={`Juntar ${p.descricao}`} />
        </label>
      ) : (
        <span className={e.aCorrer}>{fase === 'a otimizar' ? 'A otimizar…' : fase === 'a enviar' ? `${Math.round(progresso * 100)}%` : 'A confirmar…'}</span>
      )}
    </li>
  );
}

function Outros({ preparar, concluir }: { preparar: Preparar; concluir: Concluir }) {
  const f = useFicheiros(20);
  const [aviso, setAviso] = useState<Estado>(null);
  const [aCorrer, setACorrer] = useState(false);
  useAvisarAoSair(aCorrer);
  const enviar = async () => {
    setACorrer(true);
    setAviso(null);
    setAviso(await enviarTodos(f, (a) => preparar(null, a), concluir));
    setACorrer(false);
  };
  const porEnviar = f.itens.some((i) => i.estado !== 'enviado');
  return (
    <section className={e.bloco}>
      <div><h3>Outros documentos</h3><p className={e.nota}>Tem um documento que não está na lista? Envie-o aqui e o contabilista associa-o.</p></div>
      <ZonaFicheiros f={f} ativo={aCorrer} titulo="Escolher ficheiros ou fotografar" compacto />
      {aviso?.erro && <p className="aviso aviso-critico" role="alert">{aviso.erro}</p>}
      {aviso?.ok && <p className="aviso aviso-positivo" role="status">{aviso.ok}</p>}
      {porEnviar && <div><button type="button" className="btn btn-sm" onClick={enviar} disabled={aCorrer}>{aCorrer ? 'A enviar…' : 'Enviar'}</button></div>}
    </section>
  );
}

function Resposta({ responder }: { responder: (texto: string) => Promise<Estado> }) {
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<Estado>(null);
  const [aCorrer, setACorrer] = useState(false);
  const enviar = async () => {
    setACorrer(true);
    const r: Estado = await responder(texto).catch(() => ({ erro: 'Sem ligação ao servidor.' }));
    setAviso(r);
    if (r?.ok) setTexto('');
    setACorrer(false);
  };
  return (
    <section className={e.bloco}>
      <div><h3>Falta-lhe algum documento?</h3><p className={e.nota}>Diga-nos o que se passa. O contabilista recebe a sua mensagem.</p></div>
      <textarea className="entrada" rows={3} maxLength={2000} value={texto} onChange={(ev) => setTexto(ev.target.value)} aria-label="A sua mensagem" placeholder="Por exemplo: a fatura X ainda não me chegou." />
      {aviso?.erro && <p className="aviso aviso-critico" role="alert">{aviso.erro}</p>}
      {aviso?.ok && <p className="aviso aviso-positivo" role="status">{aviso.ok}</p>}
      <div><button type="button" className="btn btn-secundario btn-sm" onClick={enviar} disabled={aCorrer || !texto.trim()}>{aCorrer ? 'A enviar…' : 'Enviar mensagem'}</button></div>
    </section>
  );
}

export function EntregaPendencias({ pendencias, recebidas, preparar, concluir, responder, compacto }: {
  pendencias: PendenciaEntrega[]; recebidas: number; preparar: Preparar; concluir: Concluir; responder?: (texto: string) => Promise<Estado>; compacto?: boolean;
}) {
  const [entregues, setEntregues] = useState(0);
  const total = pendencias.length + recebidas;
  const feitas = recebidas + entregues;
  const fim = entregues >= pendencias.length && pendencias.length > 0;
  const lista = grupos(pendencias);
  return (
    <div className={e.entrega}>
      <div className={e.progresso}>
        <div className={e.progressoTexto}><strong>{feitas} de {total} entregues</strong><span>{fim ? 'Não falta nada. Obrigado.' : `Faltam ${total - feitas}.`}</span></div>
        <div className={e.barra}><i style={{ inlineSize: `${total ? Math.round((feitas / total) * 100) : 0}%` }} /></div>
      </div>
      {lista.map((g) => (
        <section key={g.titulo} className={e.grupo}>
          <h3>{g.titulo}</h3>
          <ul className={e.linhas}>
            {g.itens.map((p) => <Linha key={p.id} p={p} preparar={preparar} concluir={concluir} aoEntregar={() => setEntregues((n) => n + 1)} />)}
          </ul>
        </section>
      ))}
      {!compacto && !fim && <Outros preparar={preparar} concluir={concluir} />}
      {responder && !fim && <Resposta responder={responder} />}
    </div>
  );
}
