// The home page contact section (row D final, 24 October 2026). There was no
// canvas design for it; it is built in row D's language on the navy ground.
//
// Where the words come from:
//   - dContact (CMS group, over contact.defaults.json): the small label, the
//     headline with its blue phrase, the line under the WhatsApp button and
//     the two small labels beside the email address and the social links.
//   - The homepage global's existing contact fields, exactly as before:
//     contactSubheading, contactInfoTitle, contactInfoText,
//     contactWhatsappButtonText, contactSubmitButtonText and
//     contactFormSuccessMessage. The fallbacks below are the words those
//     fields hold on the live CMS today.
//   - siteSettings: the email address, the WhatsApp number and opening
//     message, and the social links.
//
// The headline: dContact.headline when an editor has filled it in. Otherwise
// the old contactHeading field still decides the words, so an edit there keeps
// working; while it reads the same as the approved headline, the approved
// version (with its blue phrase) is shown.
import defaults from './contact.defaults.json';
import { pick, plain } from './emph';

export type DContactWords = typeof defaults & {
  sub: string;
  infoTitle: string;
  infoText: string;
  whatsappLabel: string;
  submitLabel: string;
  success: string;
};

export type DContactDetails = {
  email: string;
  whatsappHref: string;
  socialLinks: any[];
};

const FALLBACK = {
  sub: 'Fill in the form or message us on WhatsApp.',
  infoTitle: 'Get in touch',
  infoText: "Tell us what you want to achieve and we'll come back with a clear next step.",
  whatsappLabel: 'Chat on WhatsApp',
  submitLabel: 'Send message',
  success: "Thanks for getting in touch. We'll reply shortly.",
};

const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

function headline(group: any, legacy: unknown): string {
  if (typeof group?.headline === 'string' && group.headline.trim()) return group.headline;
  if (typeof legacy === 'string' && legacy.trim() && !same(legacy, plain(defaults.headline))) return legacy;
  return defaults.headline;
}

/** The section's words: dContact over the defaults, plus the homepage's contact fields. */
export function loadContact(homepage: any): DContactWords {
  const g = homepage?.dContact || {};
  return {
    eyebrow: pick(g.eyebrow, defaults.eyebrow),
    headline: headline(g, homepage?.contactHeading),
    whatsappNote: pick(g.whatsappNote, defaults.whatsappNote),
    emailLabel: pick(g.emailLabel, defaults.emailLabel),
    socialLabel: pick(g.socialLabel, defaults.socialLabel),
    sub: pick(homepage?.contactSubheading, FALLBACK.sub),
    infoTitle: pick(homepage?.contactInfoTitle, FALLBACK.infoTitle),
    infoText: pick(homepage?.contactInfoText, FALLBACK.infoText),
    whatsappLabel: pick(homepage?.contactWhatsappButtonText, FALLBACK.whatsappLabel),
    submitLabel: pick(homepage?.contactSubmitButtonText, FALLBACK.submitLabel),
    success: pick(homepage?.contactFormSuccessMessage, FALLBACK.success),
  };
}

/** How to reach us, from siteSettings, built exactly as ContactSection.astro built it. */
export function contactDetails(settings: any): DContactDetails {
  const number = settings?.whatsappNumber;
  const message = settings?.whatsappMessage || "Hi Quadem Digital! I'd like to discuss a project.";
  return {
    email: settings?.email || 'ernest@quademdigital.com',
    whatsappHref: number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : '',
    socialLinks: Array.isArray(settings?.socialLinks) ? settings.socialLinks : [],
  };
}
