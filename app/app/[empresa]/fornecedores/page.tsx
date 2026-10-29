import { ListaContas } from '@/components/lista-contas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fornecedores' };

export default async function Pagina({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ empresa }, { q }] = await Promise.all([params, searchParams]);
  return <ListaContas id={empresa} secao="fornecedores" procura={q} />;
}
