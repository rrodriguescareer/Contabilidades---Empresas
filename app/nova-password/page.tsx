import { Submeter } from '@/components/forms';
import { EcraAutenticacao } from '@/lib/auth-view';
import { changePassword } from '@/lib/auth-actions';
import { CampoPalavraPasse } from '@/components/campo-palavra-passe';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nova palavra-passe' };

export default async function NovaPalavraPasse({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <EcraAutenticacao titulo="Defina a nova palavra-passe." descricao="Escolha uma que não use em mais lado nenhum." erro={erro}>
      <form action={changePassword}>
        <CampoPalavraPasse rotulo="Nova palavra-passe" />
        <Submeter>Guardar palavra-passe</Submeter>
      </form>
    </EcraAutenticacao>
  );
}
