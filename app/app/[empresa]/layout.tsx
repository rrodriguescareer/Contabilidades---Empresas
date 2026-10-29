import { empresaDaSessao } from '@/lib/auth';
import { Portal } from '@/components/portal';

export const dynamic = 'force-dynamic';

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, contexto, empresa } = await empresaDaSessao(id);
  // Mensagens do outro lado ainda por ler, para o número no menu.
  const { count } = await client.from('empresa_mensagens').select('id', { count: 'exact', head: true })
    .eq('company_id', empresa.id).is('lida_em', null).eq('do_gabinete', !contexto.is_staff);
  return (
    <Portal empresa={empresa} empresas={contexto.empresas} nome={contexto.nome} gabinete={contexto.is_staff} porLer={count ?? 0}>
      {children}
    </Portal>
  );
}
