'use client';
import { useActionState } from 'react';
import { enviarComprovativo, type Estado } from '@/lib/acoes-empresa';

/** Juntar o comprovativo de pagamento de um imposto. */
export function Comprovativo({ empresa, imposto }: { empresa: string; imposto: string }) {
  const [estado, enviar, aEnviar] = useActionState<Estado, FormData>(enviarComprovativo, null);
  return (
    <form action={enviar} className="linha">
      <input type="hidden" name="empresa" value={empresa} />
      <input type="hidden" name="imposto" value={imposto} />
      <input type="file" name="ficheiros" accept="application/pdf,image/jpeg,image/png,image/webp" required aria-label="Comprovativo" />
      <button className="btn btn-secundario btn-sm" type="submit" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar comprovativo'}</button>
      {estado?.erro && <span className="pequeno" style={{ color: 'var(--critico)' }}>{estado.erro}</span>}
      {estado?.ok && <span className="pequeno" style={{ color: 'var(--positivo)' }}>{estado.ok}</span>}
    </form>
  );
}
