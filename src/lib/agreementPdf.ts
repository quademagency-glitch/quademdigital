import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fonts from './pdf-assets/inter.json';
import extended from './pdf-assets/inter-extended.json';

export type AgreementBlock = { kind: 'title' | 'heading' | 'paragraph' | 'bullet' | 'space' | 'signatures'; text?: string; bold?: boolean };

/** Layout only: clauses and commercial terms are supplied unchanged by the agreement generator. */
export async function renderAgreementPdf(businessName: string, blocks: AgreementBlock[]): Promise<Buffer> {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(Buffer.from(fonts.regular, 'base64'), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fonts.bold, 'base64'), { subset: true });
  const fallback = await pdf.embedFont(Buffer.from(extended.regular, 'base64'), { subset: true });
  const supported = new Set(regular.getCharacterSet());
  const navy = rgb(0.035, 0.075, 0.22), cyan = rgb(0, 0.69, 0.81), ink = rgb(0.08, 0.12, 0.2), muted = rgb(0.36, 0.41, 0.49), rule = rgb(0.84, 0.89, 0.91);
  const W = 595.28, H = 841.89, M = 44, WIDTH = W - M * 2;
  let page: PDFPage, y = 0; const pages: PDFPage[] = [];
  pdf.setTitle(`Service Agreement | ${businessName}`); pdf.setAuthor('Quadem Digital Enterprise'); pdf.setLanguage('en-GB');
  const chosen = (ch: string, font: PDFFont) => supported.has(ch.codePointAt(0)!) ? font : fallback;
  const width = (text: string, size: number, font: PDFFont) => Array.from(text).reduce((n, ch) => n + chosen(ch, font).widthOfTextAtSize(ch, size), 0);
  function draw(text: string, x: number, top: number, size = 10.5, font = regular, color = ink) {
    let run = '', active = font;
    const flush = () => { if (!run) return; page.drawText(run, { x, y: H - top - size, size, font: active, color }); x += active.widthOfTextAtSize(run, size); run = ''; };
    for (const ch of text) { const f = chosen(ch, font); if (f !== active) { flush(); active = f; } run += ch; } flush();
  }
  function wrap(text: string, max: number, size: number, font: PDFFont) {
    const lines: string[] = [];
    for (const paragraph of text.replace(/\r/g, '').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (width(line ? `${line} ${word}` : word, size, font) <= max) line = line ? `${line} ${word}` : word;
        else { if (line) lines.push(line); line = ''; for (const ch of word) { if (line && width(line + ch, size, font) > max) { lines.push(line); line = ''; } line += ch; } }
      }
      lines.push(line);
    }
    return lines;
  }
  function addPage() {
    page = pdf.addPage(); page.setSize(W, H); pages.push(page);
    draw('QUADEM DIGITAL ENTERPRISE', M, 34, 10, bold, navy);
    draw('SERVICE AGREEMENT', 414, 36, 8, regular, muted);
    page.drawRectangle({ x: M, y: H - 59, width: WIDTH, height: 2, color: cyan }); y = 83;
  }
  function room(height: number) { if (y + height > 759) addPage(); }
  addPage();
  for (const b of blocks) {
    const value = b.text || '';
    if (b.kind === 'space') { y += 7; continue; }
    if (b.kind === 'signatures') {
      room(172);
      for (const [index, first] of ['Service Provider Signature', 'Client Signature'].entries()) {
        const x = M + index * (WIDTH / 2 + 10), w = WIDTH / 2 - 10;
        for (const [i, label] of [first, 'Name', 'Date'].entries()) {
          draw(label, x, y + i * 50, 9, bold, muted);
          page.drawRectangle({ x, y: H - y - i * 50 - 39, width: w, height: 0.7, color: rule });
        }
      }
      y += 167; continue;
    }
    const heading = b.kind === 'heading', title = b.kind === 'title', bullet = b.kind === 'bullet';
    const size = title ? 28 : heading ? 12 : 10.5;
    const font = title || heading || b.bold ? bold : regular;
    const gap = title ? 15 : heading ? 11 : bullet ? 5 : 7;
    const lines = wrap(value, WIDTH - (bullet ? 15 : 0), size, font);
    // Keep clause headings with their opening text, and signature headings with the signing area.
    if (heading) { room(/SIGNATURES/.test(value) ? 250 : 70); y += 9; }
    else room(Math.min(lines.length, 3) * (size + 5) + gap);
    for (const [i, line] of lines.entries()) {
      room(size + 5);
      if (bullet && i === 0) draw('•', M + 1, y, size, regular, cyan);
      draw(line, M + (bullet ? 15 : 0), y, size, font, title || heading ? navy : ink); y += size + 5;
    }
    y += gap;
  }
  for (let i = 0; i < pages.length; i++) {
    page = pages[i]; page.drawRectangle({ x: M, y: 57, width: WIDTH, height: 0.7, color: rule });
    draw('ernest@quademdigital.com | quademdigital.com', M, 797, 8, regular, muted);
    draw(`${i + 1} / ${pages.length}`, W - M - 27, 797, 8, bold, muted);
  }
  return Buffer.from(await pdf.save());
}
