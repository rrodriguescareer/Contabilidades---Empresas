'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { comunicarPessoal } from '@/lib/acoes-empresa';
import { concluirFicheiros, prepararFicheiros, type Estado } from '@/lib/envios';
import { enviarTodos, useAvisarAoSair, useFicheiros, ZonaFicheiros } from './carregador';
import p from './paginas.module.css';

/** Uma comunicação de pessoal: primeiro os dados, depois os documentos,
    carregados diretamente para o Storage e ligados ao pedido. */
export function FormPessoal({ empresa, comunicacao, botao, documentos, children }: {
  empresa: string; comunicacao: string; botao: string; documentos: string; children: React.ReactNode;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const f = useFicheiros(10);
  const [estado, setEstado] = useState<Estado>(null);
  const [aEnviar, setAEnviar] = useState(false);
  useAvisarAoSair(aEnviar);

  async function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    const dados = new FormData(e.currentTarget);
    const anexos = f.itens.filter((i) => i.estado !== 'enviado');
    dados.set('anexos', String(anexos.length));
    setAEnviar(true);
    setEstado(null);
    try {
      const r = await comunicarPessoal(null, dados);
      if (!r?.id) { setEstado({ erro: r?.erro || 'Não foi possível enviar.' }); return; }
      let final: Estado = { ok: r.ok };
      if (anexos.length) {
        const envio = await enviarTodos(f,
          (anuncios) => prepararFicheiros(empresa, 'pessoal', r.id!, anuncios),
          (ids, falhados) => concluirFicheiros(empresa, 'pessoal', r.id!, ids, falhados));
        final = envio?.ok ? { ok: `${r.ok} ${envio.ok}` } : { ok: `${r.ok} Mas os documentos não seguiram: ${envio?.erro}` };
      }
      setEstado(final);
      formulario.current?.reset();
      f.esvaziar();
      router.refresh();
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={submeter} className={p.formulario}>
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="comunicacao" value={comunicacao} />
      <fieldset disabled={aEnviar} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>{children}</fieldset>
      <div className="pilha pilha-2">
        <span className="pequeno"><strong>Documentos</strong> · {documentos}</span>
        <ZonaFicheiros f={f} ativo={aEnviar} compacto titulo="Juntar documentos" nota="PDF ou fotografia, até 10 ficheiros" />
      </div>
      {estado?.erro && <p className="aviso aviso-critico" role="alert">{estado.erro}</p>}
      {estado?.ok && <p className="aviso aviso-positivo" role="status">{estado.ok}</p>}
      <div><button className="btn" type="submit" disabled={aEnviar}>{aEnviar ? 'A enviar…' : botao}</button></div>
    </form>
  );
}
