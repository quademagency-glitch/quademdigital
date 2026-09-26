import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fonts from './pdf-assets/inter.json';

export interface WelcomePackInput {
  businessName: string; contactName: string; email: string; phone?: string;
  service: string; package?: string; startDate?: string;
  customizations?: { platforms?: string; postsPerMonth?: number; numberOfPages?: number; paymentTerms?: string };
  emailNotes?: { welcome?: string };
}

const labels: Record<string, string> = {
  'web-design': 'Web Design & Development', 'digital-marketing': 'Digital Marketing',
  branding: 'Branding & Identity', 'video-production': 'AI Video & Reels',
  'seo-paid-ads': 'SEO & Paid Advertising', 'social-media': 'Social Media Management', multiple: 'Multiple Services',
};
const W = 595.28, H = 841.89, M = 44, WIDTH = W - 2 * M;
const navy = rgb(0.035, 0.075, 0.22), cyan = rgb(0, 0.69, 0.81);
const ink = rgb(0.08, 0.12, 0.2), muted = rgb(0.36, 0.41, 0.49);
const line = rgb(0.84, 0.89, 0.91), pale = rgb(0.94, 0.97, 0.98), white = rgb(1, 1, 1);

/** Self-contained PDF bytes: no browser, office converter or network call in the email request. */
export async function generateWelcomePackPdf(c: WelcomePackInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(Buffer.from(fonts.regular, 'base64'), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fonts.bold, 'base64'), { subset: true });
  pdf.setTitle(`Welcome Pack | ${c.businessName}`);
  pdf.setAuthor('Ernest Avorwlanu | Quadem Digital');
  pdf.setSubject('Your project, next steps and point of contact');
  pdf.setLanguage('en-GB');
  const pages: PDFPage[] = [];
  let page: PDFPage, y = 0;
  const text = (value: string, x: number, top: number, size = 11, font = regular, color = ink) =>
    page.drawText(value, { x, y: H - top - size, size, font, color });
  const rect = (x: number, top: number, width: number, height: number, color = pale) =>
    page.drawRectangle({ x, y: H - top - height, width, height, color });
  function newPage(continuation = false) {
    page = pdf.addPage(); page.setSize(W, H); pages.push(page);
    rect(M, 34, 5, 16, cyan);
    text('QUADEM DIGITAL', M + 15, 34, 11, bold);
    text('CLIENT WELCOME PACK', 379, 36, 8, regular, muted);
    y = 87;
    if (continuation) { text('Your project, continued', M, y, 20, bold); y += 40; }
  }
  function wrap(value: string, width: number, size: number, font: PDFFont) {
    const result: string[] = [];
    for (const paragraph of String(value).replace(/\r/g, '').split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (font.widthOfTextAtSize(current ? `${current} ${word}` : word, size) <= width) {
          current = current ? `${current} ${word}` : word;
        } else {
          if (current) result.push(current);
          current = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(current + ch, size) > width && current) { result.push(current); current = ''; }
            current += ch;
          }
        }
      }
      result.push(current);
    }
    return result;
  }
  function para(value: string, size = 11, font = regular, color = ink, width = WIDTH, x = M) {
    for (const t of wrap(value, width, size, font)) {
      if (y + size + 7 > 756) newPage(true);
      text(t, x, y, size, font, color); y += size + 6;
    }
  }
  function row(label: string, value: string) {
    const lines = wrap(value, WIDTH - 128, 10.5, regular);
    if (y + Math.min(lines.length, 4) * 16 + 23 > 756) newPage(true);
    rect(M, y, WIDTH, 0.7, line); y += 12;
    text(label.toUpperCase(), M, y + 1, 8, bold, muted);
    for (const t of lines) {
      if (y + 16 > 756) newPage(true);
      text(t, M + 128, y, 10.5); y += 16;
    }
    y += 12;
  }
  newPage();
  rect(0, 0, W, 267, navy);
  rect(M, 37, 5, 16, cyan);
  text('QUADEM DIGITAL', M + 15, 37, 11, bold, white);
  text('CLIENT WELCOME PACK', M, 88, 9, bold, cyan);
  text('A clear start.', M, 111, 43, bold, white);
  text('Good work ahead.', M, 161, 43, bold, white);
  text('Your project. Your next steps. Your point of contact.', M, 228, 10, regular, white);
  y = 297;
  text('PREPARED FOR', M, y, 8, bold, muted); y += 20;
  para(c.businessName, 24, bold); y += 12;
  const cx = c.customizations || {};
  const scope = [labels[c.service] || c.service, cx.platforms, cx.postsPerMonth ? `${cx.postsPerMonth} posts per month` : '', cx.numberOfPages ? `${cx.numberOfPages} pages` : ''].filter(Boolean).join(' / ');
  row('Service', scope);
  if (c.package) row('Package', c.package);
  row('Your contact', `${c.contactName}\n${c.email}${c.phone ? `\n${c.phone}` : ''}`);
  const date = c.startDate ? new Date(c.startDate) : null;
  row('Start date', date && Number.isFinite(date.valueOf()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'To be agreed');
  // The contract owns price and cadence. Never turn a one-off project into a monthly retainer.
  row('Payment terms', cx.paymentTerms || 'See your Service Agreement for the agreed price, payment schedule and scope.');
  if (c.emailNotes?.welcome) { y += 9; para('A NOTE FROM ERNEST', 8, bold, muted); y += 6; para(c.emailNotes.welcome, 10.5); }

  newPage();
  text('Let\'s get started.', M, y, 30, bold); y += 51;
  para(`Hi ${c.contactName}, thank you for choosing Quadem Digital. I will be your point of contact throughout the project. Here is what happens next.`, 11); y += 25;
  const steps = [
    ['01', 'Review your agreement', 'Your Service Agreement arrives in a separate email. Check the scope, fee and terms, then follow the signing instructions. Send me any questions before signing.'],
    ['02', 'Gather your project materials', 'Your setup email contains the checklist for your service. Prepare your brand assets, content and the access requested there. Use account invitations where available; do not email passwords.'],
    ['03', 'Confirm the plan together', 'I will contact you to arrange a kick-off conversation. We will confirm priorities, responsibilities and the first milestones against your agreed start date.'],
  ];
  for (const [number, title, body] of steps) {
    if (y + 135 > 756) newPage();
    text(number, M, y, 19, bold, cyan);
    text(title, M + 45, y + 1, 14, bold); y += 28;
    para(body, 10.5, regular, muted, WIDTH - 45, M + 45); y += 24;
  }
  if (y + 181 > 756) newPage();
  rect(M, y, WIDTH, 164, navy);
  text('ONE POINT OF CONTACT', M + 22, y + 20, 8, bold, cyan);
  text('Ernest Avorwlanu', M + 22, y + 42, 22, bold, white);
  text('Founder, Quadem Digital', M + 22, y + 74, 10, regular, white);
  text('ernest@quademdigital.com', M + 22, y + 103, 11, regular, white);
  text('WhatsApp  +233 53 089 0302', M + 22, y + 126, 11, regular, white);
  for (let i = 0; i < pages.length; i++) {
    page = pages[i]; rect(M, 784, WIDTH, 0.7, line);
    text('quademdigital.com', M, 798, 8, regular, muted);
    text('Prepared for your project / Keep for reference', M + 155, 798, 7.5, regular, muted);
    text(`${String(i + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`, W - M - 40, 798, 8, bold, muted);
  }
  return Buffer.from(await pdf.save());
}
