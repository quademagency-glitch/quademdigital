// The home page FAQ section (row D final, 24 October 2026). There was no canvas
// design for it; it is built in row D's language on the light paper ground.
//
// Words around the questions (the giant outlined title and its label, the small
// label, headline, line and link): the CMS group dFaq merged over
// faq.defaults.json, field by field. The questions and answers themselves stay in the faqs
// collection, which also feeds the FAQPage structured data in index.astro, so
// what a visitor reads and what search engines are told stay the same list.
import defaults from './faq.defaults.json';
import { pick } from './emph';

export type DFaqWords = typeof defaults;
export type DFaqItem = { id: string; question: string; paragraphs: string[] };

/** The CMS group dFaq over the approved words. */
export function loadFaq(homepage: any): DFaqWords {
  const g = homepage?.dFaq || {};
  return {
    pageTitle: pick(g.pageTitle, defaults.pageTitle),
    pageLabel: pick(g.pageLabel, defaults.pageLabel),
    eyebrow: pick(g.eyebrow, defaults.eyebrow),
    headline: pick(g.headline, defaults.headline),
    sub: pick(g.sub, defaults.sub),
    link: pick(g.link, defaults.link),
  };
}

/**
 * The questions to show: the same filter the FAQPage data uses (a question and
 * an answer), in the collection's order. An answer typed with blank lines
 * between paragraphs keeps them.
 */
export function faqItems(faqs: any[] = []): DFaqItem[] {
  return (faqs || [])
    .filter((faq: any) => faq?.question && faq?.answer)
    .map((faq: any, index: number) => ({
      id: `faq-${faq.id ?? index + 1}`,
      question: String(faq.question).trim(),
      paragraphs: String(faq.answer).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    }));
}
