/** Billing labels shared by homepage, international and service price cards. */
export function billingKind(raw) {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!value || /^(one[- ]off|one time|once|starting at|per project)\b/.test(value)) return 'once';
    if (/\b(month|monthly)\b|^\/?mo\b/.test(value)) return 'monthly';
    if (/\b(year|yearly|annual|annually)\b|^\/?yr\b/.test(value)) return 'yearly';
    return 'unknown';
}

export function billingCadence(raw) {
    const labels = { once: 'one off', monthly: 'a month', yearly: 'a year' };
    return labels[billingKind(raw)] || String(raw || '').trim();
}

export function billingKicker(raw) {
    return { once: 'One-off', monthly: 'Monthly', yearly: 'Yearly' }[billingKind(raw)] || '';
}
