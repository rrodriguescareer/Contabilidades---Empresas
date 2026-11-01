import { entrarCom } from '@/lib/entrar-com';
import { fornecedoresAtivos } from '@/lib/fornecedores';

/** «Continuar com Google / Apple», só para os fornecedores ligados. */
export async function ContinuarCom({ destino = '', nota }: { destino?: string; nota?: string }) {
  const ativos = await fornecedoresAtivos();
  if (!ativos.length) return null;
  return (
    <div className="pilha pilha-3">
      {ativos.map((f) => (
        <form key={f} action={entrarCom}>
          <input type="hidden" name="fornecedor" value={f} />
          <input type="hidden" name="destino" value={destino} />
          <button type="submit" className="btn btn-secundario btn-bloco" style={{ gap: '.6rem' }}>
            {f === 'google' ? (
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M16.37 12.6c-.03-2.7 2.2-4 2.3-4.07-1.26-1.84-3.21-2.09-3.9-2.12-1.66-.17-3.24.98-4.08.98-.85 0-2.14-.96-3.52-.93-1.81.03-3.48 1.05-4.41 2.67-1.88 3.26-.48 8.08 1.35 10.73.9 1.29 1.96 2.75 3.36 2.7 1.35-.05 1.86-.87 3.49-.87 1.63 0 2.09.87 3.51.84 1.45-.02 2.37-1.32 3.26-2.62 1.03-1.5 1.45-2.96 1.47-3.03-.03-.01-2.82-1.08-2.85-4.29zM13.7 4.67c.74-.9 1.24-2.15 1.11-3.39-1.07.04-2.36.71-3.13 1.61-.68.79-1.28 2.06-1.12 3.28 1.19.09 2.4-.6 3.14-1.5z" />
              </svg>
            )}
            Continuar com {f === 'google' ? 'Google' : 'Apple'}
          </button>
        </form>
      ))}
      {nota && <p className="micro tenue" style={{ textAlign: 'center' }}>{nota}</p>}
      <p className="micro suave" style={{ textAlign: 'center' }}>ou com o email</p>
    </div>
  );
}
