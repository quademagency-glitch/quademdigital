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

export const payloadFetch = async (collection: string, query?: Record<string, string>) => {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const cacheKey = `collection:${collection}${qs}`;
  const cached = getCached<unknown[]>(cacheKey);
  if (cached) return cached;

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
    setCached(cacheKey, docs);
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

export const buildPayloadImageUrl = (imageDoc: any) => {
  if (!imageDoc || !imageDoc.url) return '';
  const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
  // If the URL is already absolute (e.g. S3), return it directly
  if (imageDoc.url.startsWith('http')) return imageDoc.url;
  return `${baseUrl}${imageDoc.url}`;
};

/**
 * Resolve a specific optimized image size from a Payload media doc.
 * Falls back to the original URL if the requested size isn't available.
 *
 * Available sizes: 'thumbnail' (400px), 'medium' (800px), 'large' (1200px), 'og' (1200×630)
 */
export const getPayloadImageSize = (imageDoc: any, size: 'thumbnail' | 'medium' | 'large' | 'og') => {
  if (!imageDoc) return '';
  const sizeData = imageDoc.sizes?.[size];
  if (sizeData?.url) {
    if (sizeData.url.startsWith('http')) return sizeData.url;
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    return `${baseUrl}${sizeData.url}`;
  }
  // Fallback to original
  return buildPayloadImageUrl(imageDoc);
};


/** Prefers the generated mockup when ready, falling back to the raw upload so the hero never shows a blank slot while a mockup is generating. */
export const resolveHeroMedia = (item: { rawMedia?: any; mockupMedia?: any; mockupStatus?: string } | null | undefined) => {
  if (!item) return null;
  if (item.mockupStatus === 'ready' && item.mockupMedia) return item.mockupMedia;
  return item.rawMedia || null;
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
      const url = buildPayloadImageUrl(node.value);
      return `<img src="${url}" alt="${node.value.alt || ''}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 24px 0;" loading="lazy" />`;
    }
    return '';
  }

  if (node.children) {
    return (node.children || []).map(lexicalToHtml).join('');
  }

  return '';
}
