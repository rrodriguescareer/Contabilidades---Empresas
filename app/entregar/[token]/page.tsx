import type { Metadata } from 'next';
import { EntregaPendencias } from '@/components/entrega-pendencias';
import e from '@/components/entrega.module.css';
import { entregaDoToken } from '@/lib/entrega-servidor';
import { concluirPelaLigacao, prepararPelaLigacao, responderPelaLigacao } from '@/lib/entregas';

export const dynamic = 'force-dynamic';
// A ligação é o acesso: não se indexa nem segue para outros sites.
export const metadata: Metadata = { title: 'Entrega de documentos', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const dataPt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

function Rodape() {
  return (
    <footer className={e.rodape}>
      <strong>Rúben Meirinho Rodrigues · Contabilista Certificado n.º 106297</strong>
      <span>Os documentos ficam guardados em privado, acessíveis apenas ao contabilista e às pessoas da empresa com acesso ao portal.</span>
      <span>Dúvidas: <a href="mailto:contabilidade.rubenrodrigues@gmail.com">contabilidade.rubenrodrigues@gmail.com</a></span>
    </footer>
  );
}

function Estado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className={e.pagina}>
      <div className={e.folha}>
        <div className={e.cabeca}><img src="/rr.svg" alt="RR." width={259} height={142} /></div>
        <section className={e.estado}><h1>{titulo}</h1><p>{texto}</p></section>
        <Rodape />
      </div>
    </main>
  );
}

export default async function Entregar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await entregaDoToken(token);
  if (d.estado === 'invalido') return <Estado titulo="Esta ligação não é válida." texto="Confirme se abriu a ligação completa do email. Se o problema continuar, responda ao email que recebeu." />;
  if (d.estado === 'terminado') {
    return d.motivo === 'nada_falta'
      ? <Estado titulo="Já recebemos tudo. Obrigado." texto={`Não falta nenhum documento de ${d.empresa}.`} />
      : <Estado titulo="Este pedido já terminou." texto="Se ainda tiver documentos para entregar, fale com o contabilista." />;
  }
  return (
    <main className={e.pagina}>
      <div className={e.folha}>
        <div className={e.cabeca}><img src="/rr.svg" alt="RR." width={259} height={142} /><span>Entrega de documentos</span></div>
        <header className={e.titulo}>
          <h1>{d.empresa}</h1>
          <p>O contabilista precisa destes documentos. Junte cada um ao respetivo pedido: pode ser PDF ou fotografia.</p>
          <span className={e.prazo}>Até {dataPt(d.dia_limite)}</span>
        </header>
        <EntregaPendencias pendencias={d.pendencias} recebidas={d.recebidas}
                           preparar={prepararPelaLigacao.bind(null, token)} concluir={concluirPelaLigacao.bind(null, token)} responder={responderPelaLigacao.bind(null, token)} />
        <Rodape />
      </div>
    </main>
  );
}
