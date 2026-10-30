import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import type { LinhaBalancete } from './cegid';
import { totais } from './contas';
import { data, dataHora, MESES, valor } from './formato';
import { MARCA_PNG } from './marca-pdf';

/* Os documentos que o portal gera: balancetes, extratos e comprovativos de
   entrega, em PDF (A4 deitado) e Excel. Todos levam o logótipo da empresa,
   quando existe, o carimbo da data de corte (quando se aplica) em cada
   página, quem extraiu, quando, e uma referência que liga o ficheiro ao
   registo de atividade. */

export type Logotipo = { bytes: Uint8Array; largura: number; altura: number } | null;

export type Coluna = { titulo: string; largura: number; numero?: boolean };
export type Linha = { valores: (string | number | null)[]; destaque?: boolean };

export type Relatorio = {
  titulo: string;
  empresa: string;
  nif: string;
  carimbo?: { titulo: string; texto: string } | null;
  meta: string[];
  colunas: Coluna[];
  linhas: Linha[];
  totais?: (string | number | null)[] | null;
  rodape: string;
  logotipo?: Logotipo;
  folha?: string;
};

/* As fontes base do PDF só conhecem o WinAnsi: o resto troca-se ou cai. */
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function seguro(t: string) {
  return Array.from(t.normalize('NFC')).map((c) => {
    const n = c.charCodeAt(0);
    if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI_EXTRA.includes(c)) return c;
    if (c === '\t' || c === '\n') return ' ';
    return '?';
  }).join('');
}

function cortar(t: string, fonte: PDFFont, tamanho: number, largura: number) {
  let s = seguro(t);
  if (fonte.widthOfTextAtSize(s, tamanho) <= largura) return s;
  while (s.length > 1 && fonte.widthOfTextAtSize(s + '…', tamanho) > largura) s = s.slice(0, -1);
  return s + '…';
}

const AZUL = rgb(10 / 255, 35 / 255, 68 / 255);
const SUAVE = rgb(101 / 255, 116 / 255, 139 / 255);
const LINHA = rgb(220 / 255, 230 / 255, 245 / 255);
const FUNDO = rgb(237 / 255, 243 / 255, 252 / 255);
const VERDE = rgb(14 / 255, 122 / 255, 95 / 255);
const VERDE_FUNDO = rgb(226 / 255, 245 / 255, 239 / 255);

const comoTexto = (v: string | number | null, numero?: boolean) =>
  v == null || v === '' ? '' : typeof v === 'number' && numero ? valor(v) : String(v);

export async function relatorioPdf(r: Relatorio) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${r.titulo} — ${r.empresa}`);
  pdf.setAuthor('Rúben Meirinho Rodrigues, Contabilista Certificado n.º 145854');
  if (r.carimbo) pdf.setSubject(`${r.carimbo.titulo}`);
  pdf.setCreator('RR. Empresas');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marca = await pdf.embedPng(Buffer.from(MARCA_PNG, 'base64'));
  let logo: PDFImage | null = null;
  if (r.logotipo) {
    try { logo = await pdf.embedPng(r.logotipo.bytes); } catch { logo = null; }
  }

  const L = 842, A = 595, M = 36, ALTURA = 14, TAM = 8.5;
  const util = L - 2 * M;
  const soma = r.colunas.reduce((t, c) => t + c.largura, 0);
  const larguras = r.colunas.map((c) => (c.largura / soma) * util);

  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const texto = (p: PDFPage, t: string, x: number, yy: number, o: { tamanho?: number; fonte?: PDFFont; cor?: ReturnType<typeof rgb> } = {}) =>
    p.drawText(seguro(t), { x, y: yy, size: o.tamanho ?? TAM, font: o.fonte ?? normal, color: o.cor ?? AZUL });

  function linha(valores: string[], o: { fonte?: PDFFont; fundo?: ReturnType<typeof rgb> } = {}) {
    if (o.fundo) pagina.drawRectangle({ x: M, y: y - 4, width: util, height: ALTURA, color: o.fundo });
    let x = M;
    r.colunas.forEach((col, i) => {
      const f = o.fonte ?? normal;
      const t = cortar(valores[i] ?? '', f, TAM, larguras[i] - 8);
      const w = f.widthOfTextAtSize(t, TAM);
      pagina.drawText(t, { x: col.numero ? x + larguras[i] - 4 - w : x + 4, y, size: TAM, font: f, color: AZUL });
      x += larguras[i];
    });
    pagina.drawLine({ start: { x: M, y: y - 4 }, end: { x: L - M, y: y - 4 }, thickness: 0.4, color: LINHA });
    y -= ALTURA;
  }

  function novaPagina(primeira: boolean) {
    pagina = pdf.addPage([L, A]);
    paginas.push(pagina);
    y = A - M;
    const largura = 54, altura = (marca.height / marca.width) * largura;
    pagina.drawImage(marca, { x: M, y: y - altura + 4, width: largura, height: altura });
    // O logótipo da empresa, à direita, até 130×40.
    if (logo) {
      const escala = Math.min(130 / logo.width, 40 / logo.height);
      pagina.drawImage(logo, { x: L - M - logo.width * escala, y: y - logo.height * escala + 4, width: logo.width * escala, height: logo.height * escala });
    }
    texto(pagina, r.titulo, M + 72, y - 6, { tamanho: primeira ? 15 : 12, fonte: negrito });
    texto(pagina, `${r.empresa} · NIF ${r.nif}`, M + 72, y - 22, { tamanho: 9.5, cor: SUAVE });
    y -= 44;
    if (r.carimbo) {
      pagina.drawRectangle({ x: M, y: y - 8, width: util, height: 22, color: VERDE_FUNDO, borderColor: VERDE, borderWidth: 0.6 });
      texto(pagina, r.carimbo.titulo, M + 8, y, { tamanho: 9, fonte: negrito, cor: VERDE });
      texto(pagina, r.carimbo.texto, M + 16 + negrito.widthOfTextAtSize(seguro(r.carimbo.titulo), 9), y, { tamanho: 8.5, cor: VERDE });
      y -= 26;
    }
    if (primeira && r.meta.length) {
      texto(pagina, r.meta.join('   ·   '), M, y, { tamanho: 8, cor: SUAVE });
      y -= 18;
    }
    linha(r.colunas.map((x) => x.titulo), { fonte: negrito, fundo: FUNDO });
  }

  novaPagina(true);
  for (const l of r.linhas) {
    if (y < M + 40) novaPagina(false);
    linha(l.valores.map((v, i) => comoTexto(v, r.colunas[i]?.numero)), l.destaque ? { fonte: negrito, fundo: FUNDO } : {});
  }
  if (r.totais) {
    if (y < M + 40) novaPagina(false);
    linha(r.totais.map((v, i) => comoTexto(v, r.colunas[i]?.numero)), { fonte: negrito, fundo: FUNDO });
  }
  if (!r.linhas.length) texto(pagina, 'Sem linhas neste período.', M + 4, y, { cor: SUAVE });

  paginas.forEach((p, i) => {
    texto(p, 'Rúben Meirinho Rodrigues · Contabilista Certificado n.º 145854 · Rua Augusto Simões 845, 4470-147 Maia', M, 20, { tamanho: 7.5, cor: SUAVE });
    const n = `Página ${i + 1} de ${paginas.length} · ${r.rodape}`;
    texto(p, n, L - M - normal.widthOfTextAtSize(seguro(n), 7.5), 20, { tamanho: 7.5, cor: SUAVE });
  });
  return pdf.save();
}

/* ------------------------------------------------------------- Excel */

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const coluna = (i: number) => String.fromCharCode(65 + i);

type Celula = string | number | null | { v: string | number; s: number };

function folha(linhas: Celula[][], larguras: number[], comLogotipo: boolean) {
  const rows = linhas.map((cels, r) => {
    const c = cels.map((cel, i) => {
      if (cel == null || cel === '') return '';
      const ref = `${coluna(i)}${r + 1}`;
      const { v, s } = typeof cel === 'object' ? cel : { v: cel, s: typeof cel === 'number' ? 2 : 0 };
      return typeof v === 'number'
        ? `<c r="${ref}" s="${s}"><v>${Math.round(v * 100) / 100}</v></c>`
        : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}"${r < 3 && comLogotipo ? ' ht="20" customHeight="1"' : ''}>${c}</row>`;
  }).join('');
  const cols = larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols>${cols}</cols><sheetData>${rows}</sheetData>${comLogotipo ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

export function relatorioXlsx(r: Relatorio) {
  const n = (v: string | number) => ({ v, s: typeof v === 'number' ? 3 : 1 });
  const verde = (v: string) => ({ v, s: 4 });
  const celulas: Celula[][] = [
    [n(r.titulo)],
    [`${r.empresa} · NIF ${r.nif}`],
    r.carimbo ? [verde(`${r.carimbo.titulo} — ${r.carimbo.texto}`)] : [],
    ...r.meta.map((m) => [m] as Celula[]),
    [],
    r.colunas.map((c) => n(c.titulo)),
    ...r.linhas.map((l): Celula[] => l.valores.map((v) => (l.destaque && v != null && v !== '' ? n(v) : v))),
    ...(r.totais ? [r.totais.map((v) => (v == null || v === '' ? null : n(v)))] : []),
    [],
    ['Rúben Meirinho Rodrigues · Contabilista Certificado n.º 145854'],
  ];
  const larguras = r.colunas.map((c) => Math.max(10, Math.round(c.largura / 5)));
  const logo = r.logotipo;
  const ficheiros: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${logo ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml((r.folha || 'Relatório').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    // 0 normal · 1 negrito · 2 número · 3 número a negrito · 4 carimbo verde
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF0E7A5F"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(folha(celulas, larguras, Boolean(logo))),
  };
  if (logo) {
    // O logótipo no canto superior direito, até 150×50 px (1 px = 9525 EMU).
    const escala = Math.min(150 / logo.largura, 50 / logo.altura, 1);
    const cx = Math.round(logo.largura * escala * 9525), cy = Math.round(logo.altura * escala * 9525);
    const ultima = r.colunas.length - 1;
    ficheiros['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    ficheiros['xl/drawings/drawing1.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>${ultima}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logotipo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`);
    ficheiros['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`);
    ficheiros['xl/media/image1.png'] = logo.bytes;
  }
  return zipSync(ficheiros, { level: 6 });
}

/* ------------------------------------------------------------- balancete */

export type Cabecalho = {
  empresa: string; nif: string; ano: number; ate: number; corte: string; exercicio: string; detalhe: string;
  extraido_por: string; extraido_em: string; referencia: string; logotipo?: Logotipo;
};

export function relatorioBalancete(c: Cabecalho, linhas: LinhaBalancete[], todas: LinhaBalancete[]): Relatorio {
  const t = totais(todas);
  return {
    titulo: `Balancete — janeiro a ${MESES[c.ate - 1]} de ${c.ano}`,
    empresa: c.empresa, nif: c.nif, logotipo: c.logotipo, folha: 'Balancete',
    carimbo: { titulo: `DATA DE CORTE: ${data(c.corte)}`, texto: 'Contabilidade revista pelo contabilista até esta data. Não inclui movimentos posteriores.' },
    meta: [`Exercício: ${c.exercicio}`, `Detalhe: ${c.detalhe}`, `Extraído em ${dataHora(c.extraido_em)} por ${c.extraido_por}`, `Referência: ${c.referencia}`],
    colunas: [
      { titulo: 'Conta', largura: 70 }, { titulo: 'Descrição', largura: 302 },
      { titulo: 'Débito', largura: 92, numero: true }, { titulo: 'Crédito', largura: 92, numero: true },
      { titulo: 'Saldo devedor', largura: 92, numero: true }, { titulo: 'Saldo credor', largura: 92, numero: true },
    ],
    linhas: linhas.map((l) => ({
      destaque: l.conta.length <= 1,
      valores: [l.conta, l.descricao, l.debito, l.credito, l.saldo > 0.005 ? l.saldo : null, l.saldo < -0.005 ? -l.saldo : null],
    })),
    totais: ['', 'Totais (contas de movimento)', t.debito, t.credito, t.devedor, t.credor],
    rodape: `Data de corte ${data(c.corte)}`,
  };
}
