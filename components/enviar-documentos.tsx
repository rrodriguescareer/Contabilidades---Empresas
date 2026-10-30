'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { concluirDocumentos, prepararDocumentos, type Estado } from '@/lib/envios';
import { CATEGORIAS } from '@/lib/categorias';
import { enviarTodos, useAvisarAoSair, useFicheiros, ZonaFicheiros } from './carregador';
import p from './paginas.module.css';

/** O envio dos documentos do mês: vários de uma vez, arrastando, escolhendo ou
    fotografando. Cada ficheiro vai diretamente para o Storage, com o
    progresso à vista; o tamanho já não depende do servidor. */
export function EnviarDocumentos({ empresa, mes, foraDoPrazo, categoriaInicial = '', notaInicial = '' }: {
  empresa: string; mes: string; foraDoPrazo: boolean; categoriaInicial?: string; notaInicial?: string;
}) {
  const router = useRouter();
  const f = useFicheiros(20);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [nota, setNota] = useState(notaInicial);
  const [estado, setEstado] = useState<Estado>(null);
  const [aEnviar, setAEnviar] = useState(false);
  useAvisarAoSair(aEnviar);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!f.itens.some((i) => i.estado !== 'enviado')) return setEstado({ erro: 'Escolha pelo menos um ficheiro.' });
    if (!categoria) return setEstado({ erro: 'Escolha o tipo de documentos.' });
    setAEnviar(true);
    setEstado(null);
    try {
      const r = await enviarTodos(f,
        (anuncios) => prepararDocumentos(empresa, mes, categoria, nota, anuncios),
        (ids, falhados) => concluirDocumentos(empresa, mes, ids, falhados));
      setEstado(r);
      if (r?.ok) { setNota(''); router.refresh(); }
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form onSubmit={submeter} className={p.envio} noValidate>
      <ZonaFicheiros f={f} ativo={aEnviar} />
      <div className={p.campos}>
        <label className="campo">
          <span>Tipo de documentos</span>
          <select className="entrada" required value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={aEnviar}>
            <option value="" disabled>Escolha…</option>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.nome} — {c.nota}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Nota para o contabilista (opcional)</span>
          <input className="entrada" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} disabled={aEnviar}
                 placeholder="Ex.: a fatura da EDP inclui dois meses" />
        </label>
      </div>
      {foraDoPrazo && (
        <p className="aviso aviso-atencao">O prazo deste mês já terminou. Pode enviar na mesma: os documentos ficam marcados como fora do prazo e o contabilista é avisado.</p>
      )}
      {estado?.erro && <p className="aviso aviso-critico" role="alert">{estado.erro}</p>}
      {estado?.ok && <p className="aviso aviso-positivo" role="status">{estado.ok}</p>}
      <div className={p.acoes}>
        <button className="btn" type="submit" disabled={aEnviar}>{aEnviar ? 'A enviar… não feche a página' : 'Enviar documentos'}</button>
      </div>
    </form>
  );
}
