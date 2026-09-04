import { payloadFetch, payloadFetchGlobal } from './payload';
import { parsePrice } from './markets.js';

/**
 * The cheapest published price for each service, in both base currencies.
 *
 * WHY THIS EXISTS
 *
 * /services/ listed all seven things Quadem sells, with highlights and a
 * "Start Your Project" button, and never mentioned money. It is the page most
 * people reach before a service page, so the site's own funnel spent its widest
 * step saying nothing about price, and a visitor comparing two services had to
 * open both to find out which was the bigger commitment.
 *
 * WHY IT READS THE SAME RECORDS THE SERVICE PAGES DO
 *
 * The obvious shortcut is a table of "from" prices typed into this file. That
 * is a seventh copy of the price list, and the whole reason the 4 September
 * audit found what it found is that the site already had six. Every figure here
 * is read from the record the service's own page renders, so a price changed in
 * the CMS moves on both pages or on neither.
 *
 * Four services keep their prices in a page global, two in the services
 * collection, and fieldwork types them into its own page file. That is not
 * tidy, and tidying it is a migration for another day; what matters is that
 * this file points at wherever they actually live rather than restating them.
 */

export type EntryPrice = {
    /** Base amounts. `null` where the service is quoted rather than priced. */
    ghs: number | null;
    usd: number | null;
};

/* The one price on this page that is not read from a record, because fieldwork
   holds its tiers in src/pages/services/fieldwork.astro rather than in the CMS.
   Kept beside the fetches rather than hidden among them so it is obvious it is
   the exception, and checked by scripts/check-markets.mjs against that file. */
const FIELDWORK_ENTRY: EntryPrice = { ghs: 900, usd: 1200 };

/** Lowest numeric price across a pricingSection's plans, per currency. */
function cheapest(plans: any[] | undefined): EntryPrice {
    const out: EntryPrice = { ghs: null, usd: null };
    for (const plan of plans || []) {
        const g = parsePrice(plan?.price).amount;
        const u = parsePrice(plan?.priceUsd).amount;
        if (g !== null && (out.ghs === null || g < out.ghs)) out.ghs = g;
        if (u !== null && (out.usd === null || u < out.usd)) out.usd = u;
    }
    return out;
}

/**
 * Keyed by the Services collection slug, which is what /services/ iterates.
 * A service missing from the result simply shows no price, which is the right
 * failure: a service page that has not been priced yet should say nothing
 * rather than guess.
 */
export async function getEntryPrices(): Promise<Record<string, EntryPrice>> {
    const [webDesign, seo, video, brand, services] = await Promise.all([
        payloadFetchGlobal('webDesignPage'),
        payloadFetchGlobal('seoPage'),
        payloadFetchGlobal('videoProductionPage'),
        payloadFetchGlobal('brandIdentityPage'),
        payloadFetch('services', { limit: '50', depth: '0' }),
    ]);

    const out: Record<string, EntryPrice> = {
        'web-design-development': cheapest(webDesign?.pricingSection?.plans),
        'seo-paid-ads': cheapest(seo?.pricingSection?.plans),
        'video-production': cheapest(video?.pricingSection?.plans),
        'branding-graphic-design': cheapest(brand?.pricingSection?.plans),
        fieldwork: FIELDWORK_ENTRY,
    };

    /* The two services whose prices live on their own collection record.
       Written after the globals so a service that gains a pricingSection in the
       collection later wins over an empty global rather than being ignored. */
    for (const service of services || []) {
        const found = cheapest(service?.pricingSection?.plans);
        if (found.ghs !== null || found.usd !== null) out[service.slug] = found;
    }

    return out;
}
