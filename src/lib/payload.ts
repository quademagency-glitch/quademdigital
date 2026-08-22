// Vercel serverless functions reuse warm instances across requests but don't
// share Next.js's `fetch` revalidation cache, so `cache: 'no-store'` here was
// a no-op — every page view still hit the CMS fresh. This in-memory cache
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
 * @param skipCache Bypass the 60s memo. Required for anything whose staleness
 *   is user-visible within the window — notably invoices: after paying, the page
 *   reloads onto the same warm instance and would show the cached "pending"
 *   copy, prompting the client to pay a second time.
 */
export const payloadFetch = async (
  collection: string,
  query?: Record<string, string>,
  { skipCache = false }: { skipCache?: boolean } = {},
) => {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const cacheKey = `collection:${collection}${qs}`;
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

  if (node.children) {
    return (node.children || []).map(lexicalToHtml).join('');
  }

  return '';
}
