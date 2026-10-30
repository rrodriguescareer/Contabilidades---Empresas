import { empresaDaSessao } from '@/lib/auth';
import { Alertas } from '@/components/alertas';
import { Portal } from '@/components/portal';

export const dynamic = 'force-dynamic';

export default async function LayoutEmpresa({ children, params }: { children: React.ReactNode; params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, user, contexto, empresa } = await empresaDaSessao(id);
  // Os números do menu: mensagens do outro lado por ler e impostos por pagar.
  const [{ count: porLer }, { count: porPagar }] = await Promise.all([
    client.from('empresa_mensagens').select('id', { count: 'exact', head: true })
      .eq('company_id', empresa.id).is('lida_em', null).eq('do_gabinete', !contexto.is_staff),
    client.from('empresa_impostos').select('id', { count: 'exact', head: true })
      .eq('company_id', empresa.id).eq('estado', 'por_pagar'),
  ]);
  return (
    <Portal empresa={empresa} empresas={contexto.empresas} nome={contexto.nome} gabinete={contexto.is_staff}
            porLer={porLer ?? 0} porPagar={porPagar ?? 0} irs={contexto.acesso_irs}
            alertas={<Alertas client={client} empresa={empresa.id} utilizador={user.id} />}>
      {children}
    </Portal>
  );
}
