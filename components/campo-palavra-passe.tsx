'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { MAXIMO, REGRAS } from '@/lib/palavra-passe';

/* A palavra-passe e a confirmação, com os vistos a acender à medida que se
   escreve. O botão de submeter do formulário não precisa de saber nada disto:
   enquanto as regras não estiverem cumpridas, o próprio campo fica inválido
   (setCustomValidity) e o browser não deixa enviar. */
export function CampoPalavraPasse({
  rotulo = 'Palavra-passe',
  nome = 'password',
  confirmacao = 'confirmation',
}: { rotulo?: string; nome?: string; confirmacao?: string }) {
  const [valor, setValor] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ver, setVer] = useState(false);
  const id = useId();
  const segunda = useRef<HTMLInputElement>(null);

  // Mudar a primeira também pode desfazer (ou fazer) a coincidência.
  useEffect(() => {
    segunda.current?.setCustomValidity(
      repetida === valor ? '' : 'As palavras-passe não coincidem.',
    );
  }, [valor, repetida]);

  const cumpridas = REGRAS.map((r) => ({ ...r, ok: r.cumpre(valor) }));
  const todas = cumpridas.every((r) => r.ok);
  const iguais = repetida.length > 0 && repetida === valor;

  return (
    <div className="palavra-passe">
      <label className="campo">
        <span>{rotulo}</span>
        <span className="entrada-com-acao">
          <input
            name={nome}
            type={ver ? 'text' : 'password'}
            className="entrada"
            autoComplete="new-password"
            maxLength={MAXIMO}
            required
            value={valor}
            aria-describedby={`${id}-regras`}
            onChange={(ev) => {
              setValor(ev.target.value);
              const ok = REGRAS.every((r) => r.cumpre(ev.target.value));
              ev.target.setCustomValidity(ok ? '' : 'A palavra-passe ainda não cumpre as regras.');
            }}
          />
          <button type="button" className="ver-senha" onClick={() => setVer((v) => !v)}
                  aria-label={ver ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}>
            {ver ? 'Esconder' : 'Mostrar'}
          </button>
        </span>
      </label>

      <ul className="regras-senha" id={`${id}-regras`} aria-live="polite">
        {cumpridas.map((r) => (
          <li key={r.id} data-ok={r.ok}>
            <span className="visto" aria-hidden="true" />
            {r.rotulo}
          </li>
        ))}
      </ul>

      <label className="campo">
        <span>Repetir a palavra-passe</span>
        <input
          name={confirmacao}
          type={ver ? 'text' : 'password'}
          className="entrada"
          autoComplete="new-password"
          maxLength={MAXIMO}
          required
          ref={segunda}
          value={repetida}
          onChange={(ev) => setRepetida(ev.target.value)}
        />
      </label>
      <ul className="regras-senha">
        <li data-ok={iguais && todas}>
          <span className="visto" aria-hidden="true" />
          As duas palavras-passe coincidem
        </li>
      </ul>
    </div>
  );
}
