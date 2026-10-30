/*
  How a visitor reached the site, saved with their enquiry.

  A lead could name the offer it claimed but not what brought the person to it:
  Google, an ad, an Instagram post. CampaignAttribution.astro notes the referring
  site and the first page in a cookie that lasts for the visit, and this reads it
  back on the server, so every form gets it without each form having to send it.

  The cookie can be forged by whoever holds it, so nothing from it is trusted: the
  site name and the paths are checked and capped, and the words are chosen here.
*/

export type Arrival = {
    /** In plain words, for the lead email and the portal. */
    cameFrom: string;
    /** This visit arrived on a tagged link, so `campaign` on the lead is why they came. */
    tagged?: boolean;
    referrer?: string;
    landingPage?: string;
    formPage?: string;
};

type Campaign = Record<string, string> | null | undefined;

/* First match wins, so the Google products sit above Google search. */
const SITES: [RegExp, string][] = [
    [/(^|\.)gemini\.google\./, 'Gemini'],
    [/(^|\.)mail\.google\./, 'Gmail'],
    [/googlequicksearchbox|(^|\.)google\.[a-z.]+$/, 'Google search'],
    [/(^|\.)bing\.com$/, 'Bing search'],
    [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo search'],
    [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo search'],
    [/(^|\.)yandex\.[a-z.]+$/, 'Yandex search'],
    [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'],
    [/(^|\.)perplexity\.ai$/, 'Perplexity'],
    [/(^|\.)claude\.ai$/, 'Claude'],
    [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'],
    [/(^|\.)instagram\.com$|com\.instagram\.android/, 'Instagram'],
    [/(^|\.)facebook\.com$|(^|\.)fb\.me$|com\.facebook\./, 'Facebook'],
    [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$|com\.linkedin\.android/, 'LinkedIn'],
    [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'X (Twitter)'],
    [/(^|\.)tiktok\.com$/, 'TikTok'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
    [/(^|\.)(whatsapp\.com|wa\.me)$|com\.whatsapp/, 'WhatsApp'],
    [/(^|\.)(outlook\.com|office\.com|live\.com)$/, 'Outlook'],
];

export const DIRECT = 'Direct or unknown (typed the address, a bookmark, or an app such as WhatsApp or email)';
export const NOT_RECORDED = 'Not recorded';

export function siteName(host: string): string {
    const name = host.toLowerCase();
    return SITES.find(([pattern]) => pattern.test(name))?.[1] ?? `A link on ${name}`;
}

/** A campaign link in words: "Google Ads", "google · cpc · accra-web", "Referral link: omek". */
export function describeCampaign(campaign: Campaign): string | null {
    if (!campaign) return null;
    const tags = [campaign.utm_source, campaign.utm_medium, campaign.utm_campaign].filter(Boolean).join(' · ');
    if (campaign.gclid) return campaign.utm_campaign ? `Google Ads · ${campaign.utm_campaign}` : 'Google Ads';
    if (tags) return `Campaign link: ${tags}`;
    return campaign.ref ? `Referral link: ${campaign.ref}` : null;
}

const cleanHost = (value: unknown) =>
    typeof value === 'string' && /^[a-z0-9.-]{1,100}$/i.test(value) ? value.toLowerCase() : undefined;

const cleanPath = (value: unknown) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined;
    return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || undefined;
};

function readCookie(cookie: string | null): Record<string, unknown> | null {
    const match = (cookie || '').match(/(?:^|;\s*)qd_arrival=([^;]*)/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/* The browser names the page a form was sent from. Only our own pages count. */
function formPageOf(referer: string | null, host: string): string | undefined {
    try {
        const url = new URL(referer || '');
        return url.hostname === host ? cleanPath(url.pathname) : undefined;
    } catch {
        return undefined;
    }
}

export function readArrival(
    { cookie, referer, host }: { cookie: string | null; referer: string | null; host: string },
    campaign?: Campaign,
): Arrival {
    const saved = readCookie(cookie);
    const referrer = cleanHost(saved?.r);
    const landingPage = cleanPath(saved?.l);
    const formPage = formPageOf(referer, host);
    const tags = saved?.c === 1 ? describeCampaign(campaign) : null;

    /* The tags on this visit's link say the most, then the site that sent them. A
       campaign cookie from an earlier visit is not why they came this time, so it
       only speaks when there is no record of this visit at all. */
    const cameFrom =
        tags ||
        (referrer && siteName(referrer)) ||
        (saved?.f === 1 && 'Facebook or Instagram') ||
        (saved ? DIRECT : describeCampaign(campaign) || NOT_RECORDED);

    return {
        cameFrom,
        ...(tags ? { tagged: true } : {}),
        ...(referrer ? { referrer } : {}),
        ...(landingPage ? { landingPage } : {}),
        ...(formPage ? { formPage } : {}),
    };
}
