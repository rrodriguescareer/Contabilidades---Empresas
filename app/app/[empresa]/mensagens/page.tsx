import { empresaDaSessao } from '@/lib/auth';
import { dataHora } from '@/lib/formato';
import { DescerAoFim, Escrever } from '@/components/conversa';
import p from '@/components/paginas.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mensagens' };

export default async function Mensagens({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: id } = await params;
  const { client, contexto, empresa } = await empresaDaSessao(id);
  // Abrir a conversa marca como lidas as mensagens do outro lado.
  await client.rpc('ler_mensagens_empresa', { empresa: empresa.id });
  const { data } = await client.from('empresa_mensagens').select('id,corpo,criado_em,do_gabinete,lida_em')
    .eq('company_id', empresa.id).order('criado_em', { ascending: false }).limit(200);
  const mensagens = [...(data ?? [])].reverse();

  return (
    <section className={`${p.cartao} ${p.chat}`}>
      <div className={p.chatTopo}>
        <img src="/ruben-rodrigues.webp" alt="" width={96} height={96} />
        <div>
          <strong>Rúben Meirinho Rodrigues</strong>
          <span>Contabilista Certificado · responde normalmente no mesmo dia útil</span>
        </div>
      </div>
      <div className={p.conversa} id="conversa">
        {mensagens.length === 0 ? (
          <p className="pequeno suave" style={{ alignSelf: 'center', textAlign: 'center', maxInlineSize: '26rem' }}>
            Ainda não há mensagens sobre {empresa.nome}. Escreva sempre que tiver uma dúvida: a resposta fica aqui, junto da empresa.
          </p>
        ) : mensagens.map((m) => {
          const meu = m.do_gabinete === contexto.is_staff;
          return (
            <div key={m.id} className={p.balao} data-meu={meu}>
              <p>{m.corpo}</p>
              <time>{m.do_gabinete ? 'Contabilista' : 'Empresa'} · {dataHora(m.criado_em)}{meu && m.lida_em ? ' · lida' : ''}</time>
            </div>
          );
        })}
      </div>
      <Escrever empresa={empresa.id} />
      <DescerAoFim alvo="conversa" />
    </section>
  );
}
