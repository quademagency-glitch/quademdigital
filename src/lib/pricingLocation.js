import { AFRICA, REST_OF_WORLD, marketFor, currencyFor } from './markets.js';

export const PRICING_COUNTRIES = Object.keys({ ...AFRICA, ...REST_OF_WORLD });
export function validPricingCountry(value) {
    const country = String(value || '').trim().toUpperCase();
    return PRICING_COUNTRIES.includes(country) ? country : '';
}

/** Pricing follows the visitor's country automatically. Development has no
 * edge geo headers; its Ghana default must never become the production fallback. */
export function resolvePricingLocation(headers, { developmentCountry = '' } = {}) {
    const detected = validPricingCountry(headers.get('x-vercel-ip-country')) ||
        validPricingCountry(headers.get('cf-ipcountry'));
    const country = detected || validPricingCountry(developmentCountry);
    return {
        country,
        market: marketFor(country),
        currency: currencyFor(country),
        source: detected ? 'detected' : country ? 'development' : 'unknown',
    };
}
