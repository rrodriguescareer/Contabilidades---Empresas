'use client';

export function Imprimir({ className = 'btn btn-secundario btn-sm' }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}>Imprimir</button>;
}
