'use client';
import { useActionState, useRef, useState } from 'react';
import { enviarDocumentos, type Estado } from '@/lib/acoes';
import { CATEGORIAS } from '@/lib/categorias';
import { tamanho } from '@/lib/formato';
import p from './paginas.module.css';

/** O envio dos documentos do mês: vários de uma vez, arrastando ou
    escolhendo (no telemóvel, também fotografando). */
export function EnviarDocumentos({ empresa, mes, foraDoPrazo }: { empresa: string; mes: string; foraDoPrazo: boolean }) {
  const [estado, enviar, aEnviar] = useActionState<Estado, FormData>(async (anterior, form) => {
    const r = await enviarDocumentos(anterior, form);
    if (r?.ok) { setEscolhidos([]); if (entrada.current) entrada.current.value = ''; }
    return r;
  }, null);
  const [escolhidos, setEscolhidos] = useState<File[]>([]);
  const [arrastar, setArrastar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const escolher = (lista: FileList | null) => setEscolhidos(lista ? Array.from(lista) : []);

  return (
    <form action={enviar} className={p.envio}>
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="mes" value={mes} />
      <label
        className={p.escolher}
        data-arrastar={arrastar}
        onDragOver={(e) => { e.preventDefault(); setArrastar(true); }}
        onDragLeave={() => setArrastar(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastar(false);
          if (entrada.current && e.dataTransfer.files.length) {
            entrada.current.files = e.dataTransfer.files;
            escolher(e.dataTransfer.files);
          }
        }}
      >
        <strong>{escolhidos.length ? `${escolhidos.length} ${escolhidos.length === 1 ? 'ficheiro escolhido' : 'ficheiros escolhidos'}` : 'Escolher ficheiros ou fotografar'}</strong>
        <span>PDF, JPEG, PNG ou WebP · até 20 de cada vez · as fotografias são otimizadas sem perder legibilidade</span>
        <input ref={entrada} type="file" name="ficheiros" multiple required
               accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
               onChange={(e) => escolher(e.target.files)} />
      </label>
      {escolhidos.length > 0 && (
        <ul className={p.escolhidos}>
          {escolhidos.map((f, i) => <li key={i}><span>{f.name}</span><span className="suave">{tamanho(f.size)}</span></li>)}
        </ul>
      )}
      <div className={p.campos}>
        <label className="campo">
          <span>Tipo de documentos</span>
          <select name="categoria" className="entrada" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.nome} — {c.nota}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Nota para o contabilista (opcional)</span>
          <input name="nota" className="entrada" maxLength={500} placeholder="Ex.: a fatura da EDP inclui dois meses" />
        </label>
      </div>
      {foraDoPrazo && (
        <p className="aviso aviso-atencao">O prazo deste mês já terminou. Pode enviar na mesma: os documentos ficam marcados como fora do prazo e o contabilista é avisado.</p>
      )}
      {estado?.erro && <p className="aviso aviso-critico" role="alert">{estado.erro}</p>}
      {estado?.ok && <p className="aviso aviso-positivo" role="status">{estado.ok}</p>}
      <div className={p.acoes}>
        <button className="btn" type="submit" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar documentos'}</button>
      </div>
    </form>
  );
}
