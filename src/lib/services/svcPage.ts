// One shape for every service page in the new style (owner, 26 Oct 2026: the
// six service pages share one layout, scroll-stories where they sell). Each
// page reads its words from where the CMS already keeps them and hands this
// shape to src/components/service/SvcPage.astro:
//   - Web design, SEO and AI video: their page globals (webDesignPage,
//     seoPage, videoProductionPage), hero / servicesSection / processSection /
//     pricingSection / faqSection / ctaSection, through fromPageGlobal();
//   - AI automation and Growth & Performance Marketing: the Services
//     collection's rich-text body, split at its h2 headings by fromServiceBody();
//   - Fieldwork: its own page file.
// Nothing here invents a word: every line comes from the CMS or the page.
import { BOOKING_PATH } from '../booking';

/** A picture of real work: a CMS media doc, or a file under /public. */
export type SvcFrame = { media?: any; file?: { src: string; srcset?: string; width: number; height: number }; shape?: 'land' | 'tall' | 'sq'; demo?: boolean };
/**
 * Real work shown beside a "what you get" item while it is the current step
 * (owner, 26 Oct 2026: "can we flop some works when we select what we
 * build"): one or two frames and a caption naming it. The page supplies it.
 */
export type SvcWorks = { frames: SvcFrame[]; name: string; tag: string; fact?: string; href?: string; linkLabel?: string };
export type SvcItem = { title: string; text: string; when?: string; points?: string[]; icon?: string; works?: SvcWorks };
export type SvcFaq = { question: string; answer: string };
export type SvcSection = { word: string; label: string; heading?: string; subtitle?: string; note?: string; items: SvcItem[] };
export type SvcPage = {
  key: string;
  label: string;
  headline: string;
  lede: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  what: SvcSection | null;
  how: SvcSection | null;
  extra: SvcSection | null;
  proof: { heading?: string; paragraphs: string[] } | null;
  pricing: { heading?: string; subtitle?: string; note?: string; tiers: any[] } | null;
  faq: { heading?: string; subtitle?: string; items: SvcFaq[] } | null;
  cta: { heading?: string; subtitle?: string };
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** "Plan (a few days)" becomes the name and how long it takes. */
export function splitWhen(title: string): { title: string; when?: string } {
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { title: m[1], when: m[2] } : { title };
}

/** "Free call (30 minutes). We look at ..." becomes a title and its sentence(s). */
export function splitLead(line: string): { title: string; text: string } {
  const at = line.search(/\.\s/);
  if (at < 0 || at > 90) return { title: line.replace(/\.$/, ''), text: '' };
  return { title: line.slice(0, at), text: line.slice(at + 1).trim() };
}

/** The words of a page global (webDesignPage and its sisters) in the shared shape. */
export function fromPageGlobal(
  page: any,
  opts: { key: string; whatWord: string; enquireLabel?: string; primaryHref?: string; pricesHref?: string },
): SvcPage {
  const hero = page?.hero || {};
  const services = page?.servicesSection || {};
  const process = page?.processSection || {};
  const pricing = page?.pricingSection || {};
  const faq = page?.faqSection || {};
  const cta = page?.ctaSection || {};
  const whatItems: SvcItem[] = arr(services.services).map((s: any) => ({
    title: str(s.title),
    text: str(s.description),
    points: arr(s.features).map((f: any) => str(f?.feature ?? f)).filter(Boolean),
    icon: str(s.iconSvg) || undefined,
  })).filter((s) => s.title);
  const steps: SvcItem[] = arr(process.steps).map((s: any) => {
    const t = splitWhen(str(s.title));
    return { title: t.title, when: t.when, text: str(s.description) };
  }).filter((s) => s.title);
  const tiers = arr(pricing.plans);
  const faqs = arr(faq.faqs).map((f: any) => ({ question: str(f.question), answer: str(f.answer) })).filter((f) => f.question && f.answer);
  return {
    key: opts.key,
    label: str(hero.badge),
    headline: str(hero.headline),
    lede: str(hero.subtitle),
    // The page's own enquiry form, unless the button promises something else
    // (SEO's "Get a free website check-up" goes to the check-up page).
    primaryCta: { label: str(hero.primaryCtaText) || opts.enquireLabel || 'Get a free quote', href: opts.primaryHref || '#enquire' },
    secondaryCta: tiers.length ? { label: str(hero.secondaryCtaText) || 'See prices', href: opts.pricesHref || '#prices' } : undefined,
    what: whatItems.length ? { word: opts.whatWord, label: str(services.heading), heading: str(services.heading), subtitle: str(services.subtitle), items: whatItems } : null,
    how: steps.length ? { word: 'The roadmap', label: str(process.heading), heading: str(process.heading), subtitle: str(process.subtitle), items: steps } : null,
    extra: null,
    proof: null,
    pricing: tiers.length ? { heading: str(pricing.heading), subtitle: str(pricing.subtitle), note: str(pricing.note), tiers } : null,
    faq: faqs.length ? { heading: str(faq.heading), subtitle: str(faq.subtitle), items: faqs } : null,
    cta: { heading: str(cta.heading), subtitle: str(cta.subtitle) },
  };
}

type Block = { kind: 'h2' | 'h3' | 'p' | 'ul' | 'ol'; text: string; items?: string[] };

/** A Lexical rich-text body as a flat list of headings, paragraphs and lists. */
export function lexicalBlocks(body: any): Block[] {
  const text = (n: any): string => arr(n?.children).map((c: any) => (c?.type === 'text' ? str(c.text) && c.text : text(c))).join('').replace(/\s+/g, ' ').trim();
  return arr(body?.root?.children).map((n: any): Block | null => {
    if (n?.type === 'heading' && (n.tag === 'h2' || n.tag === 'h3')) return { kind: n.tag, text: text(n) };
    if (n?.type === 'list') return { kind: n.listType === 'number' ? 'ol' : 'ul', text: '', items: arr(n.children).map(text).filter(Boolean) };
    if (n?.type === 'paragraph') { const t = text(n); return t ? { kind: 'p', text: t } : null; }
    return null;
  }).filter(Boolean) as Block[];
}

/**
 * A Services document (AI automation, Growth & Performance Marketing) in the
 * shared shape. Its body is split at the h2 headings it already has: "What
 * you get", "How it works", a section of its own (such as "What it will never
 * do"), the proof ("The result, measured", "Work we've done") and "Common
 * questions", whose h3s are the questions.
 */
export function fromServiceBody(service: any, opts: { key: string; whatWord: string; extraWord?: string; label?: string; headline?: string }): SvcPage {
  const blocks = lexicalBlocks(service?.body);
  const sections: { heading: string; blocks: Block[] }[] = [];
  for (const b of blocks) {
    if (b.kind === 'h2') sections.push({ heading: b.text, blocks: [] });
    else if (sections.length) sections[sections.length - 1].blocks.push(b);
  }
  const find = (re: RegExp) => sections.find((s) => re.test(s.heading));
  const listOf = (s?: { blocks: Block[] }) => (s?.blocks.find((b) => b.items)?.items || []);
  const paras = (s?: { blocks: Block[] }) => (s?.blocks.filter((b) => b.kind === 'p').map((b) => b.text) || []);

  const whatS = find(/what you get/i);
  const howS = find(/how it works/i);
  const faqS = find(/question/i);
  const proofS = find(/result|work we/i);
  const extraS = sections.find((s) => s !== whatS && s !== howS && s !== faqS && s !== proofS);

  const faqs: SvcFaq[] = [];
  for (const b of faqS?.blocks || []) {
    if (b.kind === 'h3') faqs.push({ question: b.text, answer: '' });
    else if (b.kind === 'p' && faqs.length) faqs[faqs.length - 1].answer = [faqs[faqs.length - 1].answer, b.text].filter(Boolean).join(' ');
  }
  const pricing = service?.pricingSection || {};
  const tiers = arr(pricing.plans);
  return {
    key: opts.key,
    label: opts.label || 'What we do for you',
    headline: opts.headline || str(service?.title),
    lede: str(service?.description),
    primaryCta: { label: 'Book a call', href: BOOKING_PATH },
    secondaryCta: tiers.length ? { label: 'See prices', href: '#prices' } : undefined,
    what: whatS ? { word: opts.whatWord, label: whatS.heading, heading: whatS.heading, note: paras(whatS)[0], items: listOf(whatS).map((t) => ({ title: t, text: '' })) } : null,
    how: howS ? {
      word: 'The roadmap', label: howS.heading, heading: howS.heading,
      items: listOf(howS).map((line) => { const l = splitLead(line); const w = splitWhen(l.title); return { title: w.title, when: w.when, text: l.text }; }),
    } : null,
    extra: extraS ? { word: opts.extraWord || extraS.heading, label: extraS.heading, heading: extraS.heading, items: listOf(extraS).map((line) => splitLead(line)) } : null,
    proof: proofS ? { heading: proofS.heading, paragraphs: paras(proofS) } : null,
    pricing: tiers.length ? { heading: str(pricing.heading), subtitle: str(pricing.subtitle), note: str(pricing.note), tiers } : null,
    faq: faqs.length ? { heading: faqS?.heading, items: faqs.filter((f) => f.answer) } : null,
    cta: { heading: 'Would rather talk it through?', subtitle: 'Book a free call instead. No commitment, just a conversation about what you are trying to do.' },
  };
}
