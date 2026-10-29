/* A regra da palavra-passe da plataforma, num sítio só: o ecrã usa-a para
   acender os vistos à medida que se escreve, o servidor usa-a para recusar.
   Oito caracteres, com maiúscula, minúscula, número e símbolo. */

export type Regra = { id: string; rotulo: string; cumpre: (p: string) => boolean };

export const REGRAS: Regra[] = [
  { id: 'tamanho', rotulo: 'Pelo menos 8 caracteres', cumpre: (p) => p.length >= 8 },
  { id: 'maiuscula', rotulo: 'Uma letra maiúscula', cumpre: (p) => /\p{Lu}/u.test(p) },
  { id: 'minuscula', rotulo: 'Uma letra minúscula', cumpre: (p) => /\p{Ll}/u.test(p) },
  { id: 'numero', rotulo: 'Um número', cumpre: (p) => /\d/.test(p) },
  { id: 'simbolo', rotulo: 'Um símbolo (! ? @ # …)', cumpre: (p) => /[^\p{L}\d\s]/u.test(p) },
];

export const MAXIMO = 128;

/** null quando está tudo bem; senão, a frase para mostrar. */
export function erroDaPalavraPasse(p: string, confirmacao?: string): string | null {
  if (p.length > MAXIMO) return `A palavra-passe tem no máximo ${MAXIMO} caracteres.`;
  const falta = REGRAS.filter((r) => !r.cumpre(p));
  if (falta.length) {
    return `A palavra-passe precisa de: ${falta.map((r) => r.rotulo.toLowerCase()).join(', ')}.`;
  }
  if (confirmacao !== undefined && confirmacao !== p) return 'As duas palavras-passe não coincidem.';
  return null;
}
