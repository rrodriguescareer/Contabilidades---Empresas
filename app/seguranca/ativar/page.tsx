import { redirect } from 'next/navigation';
import { AtivarDoisFatores } from '@/components/ativar-dois-fatores';
import { EcraAutenticacao } from '@/lib/auth-view';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ativar dois fatores' };

export default async function Ativar({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const { destino } = await searchParams;
  const seguir = destino && /^\/(?![\/\\])[^\\\s]*$/.test(destino) ? destino : '/app';
  const client = await supabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/entrar');
  return (
    <EcraAutenticacao
      titulo="Ativar a autenticação de dois fatores."
      descricao="Leia o código QR com a aplicação de autenticação e escreva o código que ela mostrar."
    >
      <AtivarDoisFatores destino={seguir} />
    </EcraAutenticacao>
  );
}
