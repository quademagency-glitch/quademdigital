export const payloadFetch = async (collection: string, query?: Record<string, string>) => {
  try {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    // Use the Payload CMS REST API
    const baseUrl = process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    
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
    const baseUrl = process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
    
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
  const baseUrl = process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
  // If the URL is already absolute (e.g. S3), return it directly
  if (imageDoc.url.startsWith('http')) return imageDoc.url;
  return `${baseUrl}${imageDoc.url}`;
};
