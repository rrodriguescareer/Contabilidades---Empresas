'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { concluirFicheiros, prepararFicheiros, type Estado } from '@/lib/envios';
import { enviarTodos, useAvisarAoSair, useFicheiros, ZonaFicheiros } from './carregador';

/** Juntar o comprovativo de pagamento de um imposto. */
export function Comprovativo({ empresa, imposto }: { empresa: string; imposto: string }) {
  const router = useRouter();
  const f = useFicheiros(5);
  const [estado, setEstado] = useState<Estado>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aberto, setAberto] = useState(false);
  useAvisarAoSair(aEnviar);

  if (!aberto) {
    return <button type="button" className="btn btn-discreto btn-sm" onClick={() => setAberto(true)}>Juntar comprovativo</button>;
  }

  async function enviar() {
    setAEnviar(true);
    setEstado(null);
    try {
      const r = await enviarTodos(f,
        (anuncios) => prepararFicheiros(empresa, 'comprovativo', imposto, anuncios),
        (ids, falhados) => concluirFicheiros(empresa, 'comprovativo', imposto, ids, falhados));
      setEstado(r);
      if (r?.ok) router.refresh();
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="pilha pilha-2" style={{ flexBasis: '100%' }}>
      <ZonaFicheiros f={f} ativo={aEnviar} compacto titulo="Escolher o comprovativo" nota="PDF ou fotografia do comprovativo de pagamento" />
      {estado?.erro && <p className="aviso aviso-critico" role="alert">{estado.erro}</p>}
      {estado?.ok && <p className="aviso aviso-positivo" role="status">{estado.ok}</p>}
      <div className="linha">
        <button type="button" className="btn btn-secundario btn-sm" disabled={aEnviar || !f.itens.length} onClick={enviar}>
          {aEnviar ? 'A enviar…' : 'Enviar comprovativo'}
        </button>
        {!aEnviar && <button type="button" className="btn-texto" onClick={() => { f.esvaziar(); setEstado(null); setAberto(false); }}>Cancelar</button>}
      </div>
    </div>
  );
}
