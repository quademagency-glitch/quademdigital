export const payloadFetch = async (collection: string, query?: Record<string, string>) => {
  try {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    // Use the Payload CMS REST API
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    
    const headers: Record<string, string> = {};
    if (import.meta.env.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
    }
    
    const res = await fetch(`${baseUrl}/api/${collection}${qs}`, {
      headers,
      cache: 'no-store'
    });
    
    if (!res.ok) {
      console.warn(`Failed to fetch Payload collection: ${collection}`);
      return [];
    }
    
    const data = await res.json();
    return data.docs || [];
  } catch (err) {
    console.error(`Error fetching ${collection}:`, err);
    return [];
  }
};

export const payloadFetchGlobal = async (global: string) => {
  try {
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    
    const headers: Record<string, string> = {};
    if (import.meta.env.PAYLOAD_API_KEY) {
      headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
    }
    
    const res = await fetch(`${baseUrl}/api/globals/${global}`, {
      headers,
      cache: 'no-store'
    });
    
    if (!res.ok) {
      console.warn(`Failed to fetch Payload global: ${global}`);
      return null;
    }
    
    return await res.json();
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
