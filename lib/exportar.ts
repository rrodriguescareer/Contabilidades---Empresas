import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import type { LinhaBalancete } from './cegid';
import { totais } from './contas';
import { data, dataHora, MESES, valor } from './formato';
import { MARCA_PNG } from './marca-pdf';

/* O balancete para entregar: PDF (A4 deitado) e Excel. Os dois levam a data
   de corte impressa em cada página, quem extraiu, quando, e uma referência
   que liga o ficheiro ao registo de atividade da empresa. */

export type Cabecalho = {
  empresa: string;
  nif: string;
  ano: number;
  ate: number;
  corte: string;
  exercicio: string;
  detalhe: string;
  extraido_por: string;
  extraido_em: string;
  referencia: string;
};

const periodo = (c: Cabecalho) => `janeiro a ${MESES[c.ate - 1]} de ${c.ano}`;

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

export async function balancetePdf(c: Cabecalho, linhas: LinhaBalancete[], todas: LinhaBalancete[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Balancete ${c.empresa} — ${periodo(c)}`);
  pdf.setAuthor('Rúben Meirinho Rodrigues, Contabilista Certificado n.º 145854');
  pdf.setSubject(`Data de corte ${data(c.corte)}`);
  pdf.setCreator('RR. Empresas');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marca = await pdf.embedPng(Buffer.from(MARCA_PNG, 'base64'));

  const L = 842, A = 595, M = 36;
  const colunas = [
    { titulo: 'Conta', largura: 70, direita: false },
    { titulo: 'Descrição', largura: L - 2 * M - 70 - 4 * 92, direita: false },
    { titulo: 'Débito', largura: 92, direita: true },
    { titulo: 'Crédito', largura: 92, direita: true },
    { titulo: 'Saldo devedor', largura: 92, direita: true },
    { titulo: 'Saldo credor', largura: 92, direita: true },
  ];
  const ALTURA = 14, TAM = 8.5;

  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const texto = (p: PDFPage, t: string, x: number, yy: number, o: { tamanho?: number; fonte?: PDFFont; cor?: ReturnType<typeof rgb> } = {}) =>
    p.drawText(seguro(t), { x, y: yy, size: o.tamanho ?? TAM, font: o.fonte ?? normal, color: o.cor ?? AZUL });

  function linha(valores: string[], o: { fonte?: PDFFont; fundo?: ReturnType<typeof rgb> } = {}) {
    if (o.fundo) pagina.drawRectangle({ x: M, y: y - 4, width: L - 2 * M, height: ALTURA, color: o.fundo });
    let x = M;
    colunas.forEach((col, i) => {
      const f = o.fonte ?? normal;
      const t = cortar(valores[i] ?? '', f, TAM, col.largura - 8);
      const w = f.widthOfTextAtSize(t, TAM);
      pagina.drawText(t, { x: col.direita ? x + col.largura - 4 - w : x + 4, y, size: TAM, font: f, color: AZUL });
      x += col.largura;
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
    texto(pagina, `Balancete — ${periodo(c)}`, M + 72, y - 6, { tamanho: primeira ? 15 : 12, fonte: negrito });
    texto(pagina, `${c.empresa} · NIF ${c.nif}`, M + 72, y - 22, { tamanho: 9.5, cor: SUAVE });
    y -= 44;

    // O carimbo da data de corte, em todas as páginas.
    pagina.drawRectangle({ x: M, y: y - 8, width: L - 2 * M, height: 22, color: VERDE_FUNDO, borderColor: VERDE, borderWidth: 0.6 });
    texto(pagina, `DATA DE CORTE: ${data(c.corte)}`, M + 8, y, { tamanho: 9, fonte: negrito, cor: VERDE });
    texto(pagina, 'Contabilidade revista pelo contabilista até esta data. Não inclui movimentos posteriores.', M + 140, y, { tamanho: 8.5, cor: VERDE });
    y -= 26;

    if (primeira) {
      const meta = [
        `Exercício: ${c.exercicio}`,
        `Detalhe: ${c.detalhe}`,
        `Extraído em ${dataHora(c.extraido_em)} por ${c.extraido_por}`,
        `Referência: ${c.referencia}`,
      ];
      texto(pagina, meta.join('   ·   '), M, y, { tamanho: 8, cor: SUAVE });
      y -= 18;
    }
    linha(colunas.map((x) => x.titulo), { fonte: negrito, fundo: FUNDO });
  }

  novaPagina(true);
  for (const l of linhas) {
    if (y < M + 40) novaPagina(false);
    linha([
      l.conta, l.descricao, valor(l.debito), valor(l.credito),
      l.saldo > 0.005 ? valor(l.saldo) : '', l.saldo < -0.005 ? valor(-l.saldo) : '',
    ], l.conta.length <= 1 ? { fonte: negrito, fundo: FUNDO } : {});
  }
  if (y < M + 40) novaPagina(false);
  const t = totais(todas);
  linha(['', 'Totais (contas de movimento)', valor(t.debito), valor(t.credito), valor(t.devedor), valor(t.credor)], { fonte: negrito, fundo: FUNDO });

  paginas.forEach((p, i) => {
    texto(p, 'Rúben Meirinho Rodrigues · Contabilista Certificado n.º 145854 · Rua Augusto Simões 845, 4470-147 Maia', M, 20, { tamanho: 7.5, cor: SUAVE });
    const n = `Página ${i + 1} de ${paginas.length} · Data de corte ${data(c.corte)}`;
    texto(p, n, L - M - normal.widthOfTextAtSize(n, 7.5), 20, { tamanho: 7.5, cor: SUAVE });
  });
  return pdf.save();
}

/* ------------------------------------------------------------- Excel */

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caracteres de controlo não são XML válido.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const coluna = (i: number) => String.fromCharCode(65 + i);

type Celula = string | number | null | { v: string | number; s: number };

function folha(linhasDeCelulas: Celula[][], larguras: number[]) {
  const linhas = linhasDeCelulas.map((cels, r) => {
    const c = cels.map((cel, i) => {
      if (cel == null || cel === '') return '';
      const ref = `${coluna(i)}${r + 1}`;
      const { v, s } = typeof cel === 'object' ? cel : { v: cel, s: typeof cel === 'number' ? 2 : 0 };
      return typeof v === 'number'
        ? `<c r="${ref}" s="${s}"><v>${Math.round(v * 100) / 100}</v></c>`
        : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${c}</row>`;
  }).join('');
  const cols = larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${linhas}</sheetData></worksheet>`;
}

export function balanceteXlsx(c: Cabecalho, linhas: LinhaBalancete[], todas: LinhaBalancete[]) {
  const t = totais(todas);
  const negrito = (v: string | number) => ({ v, s: typeof v === 'number' ? 3 : 1 });
  const verde = (v: string) => ({ v, s: 4 });
  const celulas: Celula[][] = [
    [negrito(`Balancete — ${periodo(c)}`)],
    [`${c.empresa} · NIF ${c.nif}`],
    [verde(`DATA DE CORTE: ${data(c.corte)} — contabilidade revista pelo contabilista até esta data; não inclui movimentos posteriores.`)],
    [`Exercício: ${c.exercicio} · Detalhe: ${c.detalhe}`],
    [`Extraído em ${dataHora(c.extraido_em)} por ${c.extraido_por} · Referência: ${c.referencia}`],
    [],
    ['Conta', 'Descrição', 'Débito', 'Crédito', 'Saldo devedor', 'Saldo credor'].map((x) => negrito(x)),
    ...linhas.map((l): Celula[] => [
      { v: l.conta, s: l.conta.length <= 1 ? 1 : 0 }, l.descricao, l.debito, l.credito,
      l.saldo > 0.005 ? l.saldo : null, l.saldo < -0.005 ? -l.saldo : null,
    ]),
    [negrito(''), negrito('Totais (contas de movimento)'), negrito(t.debito), negrito(t.credito), negrito(t.devedor), negrito(t.credor)],
    [],
    ['Rúben Meirinho Rodrigues · Contabilista Certificado n.º 145854'],
  ];

  const ficheiros: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Balancete" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    // 0 normal · 1 negrito · 2 número · 3 número a negrito · 4 carimbo verde
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF0E7A5F"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(folha(celulas, [12, 52, 16, 16, 16, 16])),
  };
  return zipSync(ficheiros, { level: 6 });
}
