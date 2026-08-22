import { getPayloadImageSize } from './payload';

/**
 * Resolves the title, description and share image for a page.
 *
 * These used to be string literals in each .astro file, so changing what Google
 * shows for a page meant a code change and a deploy. Blog posts were the worst
 * of it: their titles lived in an if/else chain keyed on slug, one branch of
 * which was keyed on a slug that had since been redirected and so could never
 * run.
 *
 * @payloadcms/plugin-seo now puts a `meta` group on every page-backed
 * collection and global, so an editor sets these in the CMS. The fallbacks stay
 * because most documents have nothing filled in yet, and an empty CMS field
 * must never mean an empty <title>.
 */
export interface SeoFallback {
  title: string;
  description?: string;
  /** Absolute or root-relative URL. Omit to use the site default card. */
  image?: string;
}

export interface ResolvedSeo {
  title: string;
  description?: string;
  ogImage?: string;
}

const trimmed = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : undefined;
};

/**
 * @param doc A Payload document or global carrying a `meta` group. Fetch it at
 *   depth 1 or more, otherwise `meta.image` is an id rather than a media doc
 *   and no share image can be resolved from it.
 */
export function resolveSeo(doc: any, fallback: SeoFallback): ResolvedSeo {
  const meta = doc?.meta ?? {};

  // The og size is 1200x630, which is what the social platforms crop to. Using
  // the original here would ship a multi-megabyte file to every scraper.
  const image =
    meta.image && typeof meta.image === 'object'
      ? trimmed(getPayloadImageSize(meta.image, 'og'))
      : undefined;

  return {
    title: trimmed(meta.title) ?? fallback.title,
    description: trimmed(meta.description) ?? fallback.description,
    ogImage: image ?? fallback.image,
  };
}
