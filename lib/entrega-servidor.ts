import 'server-only';
import { createHash } from 'node:crypto';
import { adminClient } from './admin-client';
import { avisarGabinete, GESTAO } from './email';
import type { Anuncio, Concluido, Lugar } from './envios';
import { tipoReal } from './tipos-ficheiro';

/* Os documentos pedidos pelo contabilista: entregues pela ligação do email, ou
 * com sessão no portal. Quem chama já confirmou o acesso; aqui trata-se do
 * envio, com o mesmo cuidado dos outros: o ficheiro vai direto para o Storage e
 * os primeiros bytes confirmam que é mesmo um PDF ou uma imagem. */

export type PendenciaEntrega = {
  id: string; periodo: string; tipo: string; descricao: string;
  numero: string | null; data_documento: string | null; valor_cents: number | null; banco: string | null;
};
export type Entrega =
  | { estado: 'invalido' }
  | { estado: 'terminado'; empresa: string; motivo: string | null }
  | { estado: 'aberto'; processo: string; empresa_id: string; empresa: string; nif: string; dia_limite: string; recebidas: number; pendencias: PendenciaEntrega[] };

const BUCKET = 'empresas-documentos';
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAXIMO = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const hojeEmLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
const limpo = (nome: unknown) => String(nome || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200) || 'documento';

export async function entregaDoToken(token: string): Promise<Entrega> {
  if (!TOKEN.test(String(token || ''))) return { estado: 'invalido' };
  const { data } = await adminClient().rpc('secretaria_entrega', { hash: createHash('sha256').update(token).digest('hex') });
  return (data as Entrega) ?? { estado: 'invalido' };
}

export async function prepararLugares(empresa: string, pendencia: string | null, ficheiros: Anuncio[], quem: string | null):
  Promise<{ erro: string } | { lugares: Lugar[] }> {
  if (pendencia !== null && !UUID.test(pendencia)) return { erro: 'Documento inválido.' };
  if (!Array.isArray(ficheiros) || !ficheiros.length) return { erro: 'Escolha pelo menos um ficheiro.' };
  if (ficheiros.length > 20) return { erro: 'Envie no máximo 20 ficheiros de cada vez.' };
  const admin = adminClient();
  const lugares: Lugar[] = [];
  for (const f of ficheiros) {
    const nome = limpo(f?.nome);
    if (!MIMES.includes(f?.mime)) { lugares.push({ nome, erro: 'só se aceitam PDF, JPEG, PNG ou WebP' }); continue; }
    if (!Number.isInteger(f.tamanho) || f.tamanho < 1 || f.tamanho > MAXIMO) { lugares.push({ nome, erro: 'tem mais de 10 MB' }); continue; }
    const { data, error } = await admin.rpc('secretaria_doc_registar', {
      empresa, pendencia, p_nome: nome, p_mime: f.mime, p_tamanho: f.tamanho,
      p_original: Number.isInteger(f.original) && f.original! > 0 ? f.original : null, quem,
    });
    const r = data as { id: string; caminho: string } | null;
    if (error || !r?.caminho) {
      if (/já não está em falta/.test(error?.message || '')) return { erro: 'Este documento já foi entregue.' };
      if (/Demasiados/.test(error?.message || '')) return { erro: 'Há demasiados envios em curso. Espere uns minutos e tente de novo.' };
      lugares.push({ nome, erro: 'não foi possível registar' });
      continue;
    }
    const { data: s } = await admin.storage.from(BUCKET).createSignedUploadUrl(r.caminho);
    if (!s?.signedUrl) {
      await admin.rpc('secretaria_doc_eliminar', { documento: r.id });
      lugares.push({ nome, erro: 'não foi possível preparar o envio' });
      continue;
    }
    lugares.push({ nome, id: r.id, url: s.signedUrl });
  }
  return { lugares };
}

async function primeirosBytes(caminho: string) {
  const { data } = await adminClient().storage.from(BUCKET).createSignedUrl(caminho, 60);
  if (!data?.signedUrl) return null;
  const r = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-15' }, cache: 'no-store' }).catch(() => null);
  if (!r?.ok || !r.body) return null;
  const leitor = r.body.getReader();
  const { value } = await leitor.read();
  void leitor.cancel().catch(() => {});
  return value ?? null;
}

export async function concluirEnvios(empresa: { id: string; nome: string; nif?: string }, ids: string[], falhados: string[], quem: string): Promise<Concluido> {
  const admin = adminClient();
  const todos = [...ids, ...falhados].filter((x) => UUID.test(String(x)));
  const { data: linhas } = todos.length
    ? await admin.from('empresa_documentos').select('id,nome,caminho,mime,estado').eq('company_id', empresa.id).in('id', todos)
    : { data: [] as { id: string; nome: string; caminho: string; mime: string; estado: string }[] };
  const porId = new Map((linhas ?? []).map((l) => [l.id, l]));

  for (const id of falhados) {
    const l = porId.get(id);
    if (!l || l.estado !== 'pendente') continue;
    await admin.storage.from(BUCKET).remove([l.caminho]);
    await admin.rpc('secretaria_doc_eliminar', { documento: l.id });
  }

  let enviados = 0;
  let terminou = false;
  const falhas: string[] = [];
  const recusados: string[] = [];
  for (const id of ids) {
    const l = porId.get(id);
    if (!l) { recusados.push(id); continue; }
    if (l.estado === 'pendente') {
      const bytes = await primeirosBytes(l.caminho);
      if (!bytes || tipoReal(bytes) !== l.mime) {
        await admin.storage.from(BUCKET).remove([l.caminho]);
        await admin.rpc('secretaria_doc_eliminar', { documento: l.id });
        falhas.push(`${l.nome}: ${bytes ? 'não é um PDF nem uma imagem' : 'o ficheiro não chegou'}`);
        recusados.push(l.id);
        continue;
      }
    }
    const { data: fim, error } = await admin.rpc('secretaria_doc_concluir', { documento: l.id, quem });
    if (error) { falhas.push(`${l.nome}: o envio não ficou concluído`); recusados.push(l.id); continue; }
    enviados++;
    if ((fim as { terminou?: boolean } | null)?.terminou) terminou = true;
  }

  if (enviados) {
    await avisarGabinete({
      chave: `${terminou ? 'entrega-completa' : 'entrega'}:${empresa.id}:${hojeEmLisboa()}`,
      assunto: terminou ? `Já não falta nada — ${empresa.nome}` : `Documentos entregues — ${empresa.nome}`,
      titulo: terminou ? 'Chegou o último documento.' : 'Chegaram documentos que tinha pedido.',
      paragrafos: [terminou ? `O processo de ${empresa.nome} terminou: não falta nada.` : `${empresa.nome} entregou documentos pedidos pela Secretária. Pode haver mais hoje: este aviso sai uma vez por dia.`],
      botao: { texto: 'Abrir a ficha do cliente', url: `${GESTAO}/secretaria/clientes/${empresa.id}` },
    });
  }
  if (falhas.length && !enviados) return { erro: falhas.join(' · '), recusados };
  return { ok: terminou ? 'Obrigado. Já não falta nada.' : enviados === 1 ? 'Documento entregue.' : `${enviados} documentos entregues.`, recusados, ...(falhas.length ? { erro: falhas.join(' · ') } : {}) };
}
