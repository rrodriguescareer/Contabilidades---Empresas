'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { confirmarAtivacao, iniciarAtivacao } from '@/lib/dois-fatores';

/** O QR code para a aplicação e o primeiro código que confirma a ativação. */
export function AtivarDoisFatores({ destino }: { destino: string }) {
  const router = useRouter();
  const [fator, setFator] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [aCorrer, correr] = useTransition();

  useEffect(() => {
    iniciarAtivacao().then((r) => ('erro' in r ? setErro(r.erro) : setFator(r))).catch(() => setErro('Sem ligação. Tente novamente.'));
  }, []);

  const confirmar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fator) return;
    correr(async () => {
      const r = await confirmarAtivacao(fator.id, codigo);
      if (r.erro) return setErro(r.erro);
      router.replace(`${destino}${destino.includes('?') ? '&' : '?'}mensagem=${encodeURIComponent('Autenticação de dois fatores ativada.')}`);
    });
  };

  if (!fator) return erro ? <p className="aviso aviso-critico" role="alert">{erro}</p> : <p className="suave">A preparar o código QR…</p>;
  return (
    <form onSubmit={confirmar} className="pilha pilha-4">
      <ol className="lista-simples">
        <li>Abra a aplicação de autenticação e escolha acrescentar uma conta.</li>
        <li>Leia este código QR (ou escreva a chave à mão).</li>
        <li>Escreva aqui o código de 6 algarismos que aparece.</li>
      </ol>
      <img src={fator.qr} alt="Código QR para a aplicação de autenticação" width={200} height={200}
           style={{ justifySelf: 'center', background: '#fff', padding: 8, borderRadius: 12 }} />
      <p className="micro suave" style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>Chave: <code>{fator.segredo}</code></p>
      <label className="campo">
        <span>Código da aplicação</span>
        <input className="entrada" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={codigo}
               onChange={(e) => setCodigo(e.target.value)} placeholder="000 000"
               style={{ fontSize: '1.4rem', letterSpacing: '.3em', textAlign: 'center' }} />
      </label>
      {erro && <p className="aviso aviso-critico" role="alert">{erro}</p>}
      <button className="btn btn-bloco" type="submit" disabled={aCorrer}>{aCorrer ? 'A confirmar…' : 'Ativar'}</button>
    </form>
  );
}
