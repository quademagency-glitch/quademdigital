// Vercel serverless functions reuse warm instances across requests but don't
// share Next.js's `fetch` revalidation cache, so `cache: 'no-store'` here was
// a no-op: every page view still hit the CMS fresh. This in-memory cache
// gives warm instances a short TTL window to avoid redundant CMS round trips
// (the CMS is a single small instance and was getting overloaded by traffic
// bursts, causing slow uploads and intermittent admin login failures).
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expires: number; data: unknown }>();

const getCached = <T>(key: string): T | undefined => {
  const entry = cache.get(key);
  if (!entry || entry.expires < Date.now()) return undefined;
  return entry.data as T;
};

const setCached = (key: string, data: unknown) => {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
};

/**
 * Collections where Payload has drafts turned on.
 *
 * This list is load-bearing. Payload does NOT filter unpublished documents out
 * of an ordinary read: `find` only consults the versions table when you pass
 * `draft=true`, and otherwise returns every row of the main table, including
 * documents saved as a draft and never published (see
 * payload/dist/collections/operations/find.js, the branch at `hasDraftsEnabled
 * && draftsEnabled`). So without the `_status` filter below, turning drafts on
 * would publish every draft the moment it was saved, which is the exact
 * opposite of what a draft is.
 *
 * Filtering here rather than at each call site because there are a dozen of
 * them (blog index, post page, RSS, sitemap) and forgetting one leaks.
 *
 * Keep in step with `versions: { drafts: true }` in cms/src/collections/.
 */
const DRAFT_ENABLED_COLLECTIONS = new Set(['blogPosts', 'pages']);

/**
 * @param skipCache Bypass the 60s memo. Required for anything whose staleness
 *   is user-visible within the window. Invoices are the case that matters:
 *   after paying, the page
 *   reloads onto the same warm instance and would show the cached "pending"
 *   copy, prompting the client to pay a second time.
 * @param draft Ask Payload for the unpublished version. Only ever set this from
 *   a verified preview session (see src/lib/preview.ts). It forces skipCache
 *   too: the memo is shared by every visitor on that warm instance, so caching
 *   a draft under the normal key would serve unpublished copy to the public.
 */
export const payloadFetch = async (
  collection: string,
  query?: Record<string, string>,
  { skipCache = false, draft = false }: { skipCache?: boolean; draft?: boolean } = {},
) => {
  const params: Record<string, string> = { ...(query || {}) };
  if (DRAFT_ENABLED_COLLECTIONS.has(collection)) {
    if (draft) params.draft = 'true';
    else params['where[_status][equals]'] = 'published';
  }
  const qs = Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  const cacheKey = `collection:${collection}${qs}`;
  if (draft) skipCache = true;
  if (!skipCache) {
    const cached = getCached<unknown[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    // Use the Payload CMS REST API
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

    const headers: Record<string, string> = {};
    if (import.meta.env.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
    }

    const res = await fetch(`${baseUrl}/api/${collection}${qs}`, { headers });

    if (!res.ok) {
      console.warn(`Failed to fetch Payload collection: ${collection}`);
      return [];
    }

    const data = await res.json();
    const docs = data.docs || [];
    if (!skipCache) setCached(cacheKey, docs);
    return docs;
  } catch (err) {
    console.error(`Error fetching ${collection}:`, err);
    return [];
  }
};

export const payloadFetchGlobal = async (global: string) => {
  const cacheKey = `global:${global}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

    const headers: Record<string, string> = {};
    if (import.meta.env.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
    }

    const res = await fetch(`${baseUrl}/api/globals/${global}`, { headers });

    if (!res.ok) {
      console.warn(`Failed to fetch Payload global: ${global}`);
      return null;
    }

    const data = await res.json();
    setCached(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`Error fetching global ${global}:`, err);
    return null;
  }
};

const mediaBase = () =>
  import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';

/**
 * A short token that changes whenever the doc does.
 *
 * The CMS now serves media as `immutable` for a year, which is the only way
 * these files stop being refetched on every single visit. That is safe only if
 * a URL stops meaning what it meant when its content changes, and a Payload
 * filename does not: `image-weight.mjs --replace` deliberately swaps different
 * artwork behind the same name so existing references keep working. Without
 * this parameter that swap would never reach anyone who had already loaded the
 * old picture.
 */
const version = (doc: any): string => {
  const stamp = doc?.updatedAt;
  if (!stamp) return '';
  const ms = Date.parse(stamp);
  return Number.isNaN(ms) ? '' : `v=${ms.toString(36)}`;
};

/** Append the cache-busting token without trampling a URL that already has a query. */
const withVersion = (url: string, doc: any): string => {
  const v = version(doc);
  if (!v) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${v}`;
};

const absolute = (url: string) => (url.startsWith('http') ? url : `${mediaBase()}${url}`);

export const buildPayloadImageUrl = (imageDoc: any) => {
  if (!imageDoc || !imageDoc.url) return '';
  return withVersion(absolute(imageDoc.url), imageDoc);
};

/**
 * Resolve a specific optimized image size from a Payload media doc.
 * Falls back to the original URL if the requested size isn't available.
 *
 * Available sizes: 'thumbnail' (400px), 'medium' (800px), 'large' (1200px), 'og' (1200×630)
 */
export const getPayloadImageSize = (
  imageDoc: any,
  size: 'thumb' | 'thumbnail' | 'card' | 'medium' | 'large' | 'og' | 'mediumAvif' | 'largeAvif',
) => {
  if (!imageDoc) return '';
  const sizeData = imageDoc.sizes?.[size];
  if (sizeData?.url) return withVersion(absolute(sizeData.url), imageDoc);
  // Fallback to original
  return buildPayloadImageUrl(imageDoc);
};

export const getPayloadImageSrcset = (imageDoc: any) => {
  if (!imageDoc || !imageDoc.sizes) return '';
  const srcset = [];
  if (imageDoc.sizes.thumb?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'thumb')} 200w`);
  if (imageDoc.sizes.thumbnail?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'thumbnail')} 400w`);
  if (imageDoc.sizes.card?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'card')} 480w`);
  if (imageDoc.sizes.medium?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'medium')} 800w`);
  if (imageDoc.sizes.large?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'large')} 1200w`);
  return srcset.join(', ');
};

/**
 * The AVIF half of a <picture>, or '' when there isn't one.
 *
 * AVIF is only generated for the 800 and 1200 sizes (see AVIF_WIDTHS in the
 * CMS): below that a quarter fewer bytes is a few hundred bytes, and it is not
 * worth several seconds of an editor's upload. Returning '' rather than
 * falling back to webp is deliberate. A <source> is an offer, and offering
 * webp twice just means the browser takes the first one and the AVIF machinery
 * did nothing.
 */
export const getPayloadAvifSrcset = (imageDoc: any) => {
  if (!imageDoc || !imageDoc.sizes) return '';
  const srcset = [];
  if (imageDoc.sizes.mediumAvif?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'mediumAvif')} 800w`);
  if (imageDoc.sizes.largeAvif?.url) srcset.push(`${getPayloadImageSize(imageDoc, 'largeAvif')} 1200w`);
  return srcset.join(', ');
};

export type ResolvedVideo = {
  /** Ordered best-first. A browser takes the first type it understands. */
  sources: { src: string; type: string }[];
  /** Narrow-viewport mp4, offered ahead of the full-size one via a media query. */
  mobileSrc: string | null;
  poster: string | null;
  width: number | null;
  height: number | null;
  /** False while the CMS is still transcoding, or if it failed. */
  optimised: boolean;
};

/**
 * Everything the <Video> component needs out of a media doc.
 *
 * Falls back to the untouched upload whenever the pipeline has not finished,
 * which is the correct behaviour and not a silent failure: a freshly uploaded
 * video plays immediately, heavy, and gets lighter a minute later without
 * anyone touching the page. `optimised` says which of those a caller is
 * looking at so a preview can say so.
 */
export const resolveVideo = (doc: any): ResolvedVideo | null => {
  if (!doc || !doc.mimeType?.startsWith('video')) return null;

  const variant = (v: any) => (v?.url ? withVersion(absolute(v.url), doc) : null);
  const webm = variant(doc.videoWebm);
  const mp4 = variant(doc.videoMp4);
  const ready = doc.videoStatus === 'ready' && Boolean(mp4);

  const sources: { src: string; type: string }[] = [];
  // WebM first: every browser that can read it should, because it is the
  // smaller file. Safari cannot, skips it, and takes the mp4 below.
  /*
    Only when it is actually the smaller file. The pipeline now discards a webm
    that lost to its mp4, but docs transcoded before that still have one
    stored, and offering it first would hand the larger file to every browser
    except Safari.
  */
  const webmWins =
    !doc.videoWebm?.filesize || !doc.videoMp4?.filesize || doc.videoWebm.filesize < doc.videoMp4.filesize;
  if (ready && webm && webmWins) sources.push({ src: webm, type: 'video/webm' });
  if (ready && mp4) sources.push({ src: mp4, type: 'video/mp4' });
  if (!sources.length) {
    const original = buildPayloadImageUrl(doc);
    if (original) sources.push({ src: original, type: doc.mimeType });
  }

  return {
    sources,
    mobileSrc: ready ? variant(doc.videoMobile) : null,
    poster: variant(doc.videoPoster),
    width: doc.videoWidth ?? null,
    height: doc.videoHeight ?? null,
    optimised: ready,
  };
};


/** Prefers the generated mockup when ready, falling back to the raw upload so the hero never shows a blank slot while a mockup is generating. */
export const resolveHeroMedia = (item: { rawMedia?: any; mockupMedia?: any; mockupStatus?: string } | null | undefined) => {
  if (!item) return null;
  if (item.mockupStatus === 'ready' && item.mockupMedia) return item.mockupMedia;
  return item.rawMedia || null;
};

const escapeAttr = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Body text is one column, so an image in it is never painted wider than the
// column. 800px covers that at 2x on a phone and at 1x everywhere else.
const BODY_IMAGE_SIZES = '(max-width: 800px) 100vw, 800px';

/**
 * An image inside rich text.
 *
 * This used to emit the untouched original at whatever size it was uploaded,
 * with no srcset and no dimensions: a phone painting a 360px column downloaded
 * the full size file, and the paragraph below it jumped once the image
 * arrived. Every derivative it needs already existed; nothing was pointing at
 * them.
 */
const renderBodyImage = (doc: any): string => {
  const src = getPayloadImageSize(doc, 'medium') || buildPayloadImageUrl(doc);
  const webp = getPayloadImageSrcset(doc);
  const avif = getPayloadAvifSrcset(doc);
  const alt = escapeAttr(doc.alt || '');
  const style = 'max-width: 100%; height: auto; border-radius: 8px; margin: 24px 0;';

  /*
     Intrinsic dimensions, not display ones. Together with height:auto above
     they let the browser reserve the right box before the file arrives, which
     is what stops the rest of the article shifting down when it does.
  */
  const dims =
    doc.width && doc.height ? ` width="${doc.width}" height="${doc.height}"` : '';

  const img =
    `<img src="${escapeAttr(src)}" alt="${alt}"${dims}` +
    (webp ? ` srcset="${escapeAttr(webp)}" sizes="${BODY_IMAGE_SIZES}"` : '') +
    ` style="${style}" loading="lazy" decoding="async" />`;

  if (!avif) return img;

  return (
    `<picture>` +
    `<source type="image/avif" srcset="${escapeAttr(avif)}" sizes="${BODY_IMAGE_SIZES}" />` +
    (webp ? `<source type="image/webp" srcset="${escapeAttr(webp)}" sizes="${BODY_IMAGE_SIZES}" />` : '') +
    img +
    `</picture>`
  );
};

/**
 * Where an internal link points, by the collection it points at. These match
 * the Astro routes; a collection missing from here renders as plain text rather
 * than guessing a URL that would 404.
 */
const INTERNAL_LINK_ROUTES: Record<string, (slug: string) => string> = {
  blogPosts: (slug) => `/blog/${slug}/`,
  caseStudies: (slug) => `/projects/${slug}/`,
  services: (slug) => `/services/${slug}/`,
  offers: (slug) => `/offers/${slug}/`,
  pages: (slug) => `/${slug}/`,
};

/**
 * Only schemes that cannot execute script. An editor pasting `javascript:...`
 * into the link dialog would otherwise become stored XSS, because this output
 * is injected with set:html.
 */
const safeHref = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('/') || url.startsWith('#')) return url;
  return /^(https?|mailto|tel):/i.test(url) ? url : null;
};

const linkHref = (fields: any): string | null => {
  if (!fields) return null;

  if (fields.linkType === 'internal') {
    const doc = fields.doc;
    // Only resolvable when the relationship was populated by the query's depth.
    const slug = doc?.value?.slug;
    const route = doc?.relationTo ? INTERNAL_LINK_ROUTES[doc.relationTo] : undefined;
    return route && slug ? route(slug) : null;
  }

  return safeHref(fields.url);
};

export function lexicalToHtml(node: any): string {
  if (!node) return '';

  if (node.root) {
    return node.root.children.map(lexicalToHtml).join('');
  }

  if (node.type === 'text') {
    // Escape HTML to prevent XSS
    let text = (node.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    
    // Apply formatting
    if (node.format & 1) text = `<strong>${text}</strong>`;
    if (node.format & 2) text = `<em>${text}</em>`;
    if (node.format & 4) text = `<del>${text}</del>`;
    if (node.format & 8) text = `<u>${text}</u>`;
    if (node.format & 16) text = `<code>${text}</code>`;
    
    return text;
  }

  if (node.type === 'paragraph') {
    return `<p>${(node.children || []).map(lexicalToHtml).join('')}</p>`;
  }

  if (node.type === 'heading') {
    const tag = node.tag || 'h2';
    return `<${tag}>${(node.children || []).map(lexicalToHtml).join('')}</${tag}>`;
  }

  if (node.type === 'quote') {
    return `<blockquote>${(node.children || []).map(lexicalToHtml).join('')}</blockquote>`;
  }

  if (node.type === 'list') {
    const tag = node.listType === 'number' ? 'ol' : 'ul';
    return `<${tag}>${(node.children || []).map(lexicalToHtml).join('')}</${tag}>`;
  }

  if (node.type === 'listitem') {
    return `<li>${(node.children || []).map(lexicalToHtml).join('')}</li>`;
  }

  if (node.type === 'upload' && node.relationTo === 'media') {
    if (node.value && typeof node.value === 'object' && node.value.url) {
      return renderBodyImage(node.value);
    }
    return '';
  }

  // Links. Lexical's default toolbar offers these, so an editor could always
  // insert one, but until 2026-08-22 there was no case for them here and the
  // node fell through to the children-only branch at the bottom: the anchor
  // disappeared and the reader was left with unclickable text.
  if (node.type === 'link' || node.type === 'autolink') {
    const inner = (node.children || []).map(lexicalToHtml).join('');
    const href = linkHref(node.fields);
    if (!href) return inner;

    const newTab = Boolean(node.fields?.newTab);
    // noopener is what stops the opened page reaching back through
    // window.opener; noreferrer keeps the referrer off third-party sites.
    const target = newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttr(href)}"${target}>${inner}</a>`;
  }

  if (node.type === 'horizontalrule') {
    return '<hr />';
  }

  if (node.type === 'linebreak') {
    return '<br />';
  }

  if (node.type === 'code') {
    // Children are text nodes, which escape themselves.
    const inner = (node.children || []).map(lexicalToHtml).join('');
    const lang = node.language ? ` class="language-${escapeAttr(node.language)}"` : '';
    return `<pre><code${lang}>${inner}</code></pre>`;
  }

  if (node.children) {
    return (node.children || []).map(lexicalToHtml).join('');
  }

  return '';
}
