/**
 * Is this offer still running?
 *
 * WHY THIS EXISTS
 *
 * Every offer on the site is badged "Limited Time Offer" and one of them says
 * "book a complete Web Design package with me this month". There was no field
 * on the collection that could make any of that stop, so all three had run
 * unchanged for as long as they had existed. A permanent limited-time offer is
 * not a limited-time offer, and a returning visitor who sees the same "this
 * month" twice stops believing the third one.
 *
 * `expiresAt` is now on the Offers collection. This is the one place that
 * decides what it means, so the index, the offer page and the sitemap cannot
 * disagree about whether something has ended.
 *
 * An offer with no expiry runs until it is unpublished by hand, which is what
 * every offer did before the field existed. Nothing already live changes.
 */
export function isOfferLive(offer: { expiresAt?: string | null } | null | undefined, now = new Date()): boolean {
    if (!offer) return false;
    if (!offer.expiresAt) return true;
    const ends = new Date(offer.expiresAt);
    if (Number.isNaN(ends.getTime())) return true; // unreadable date: fail open, do not hide a live offer
    /* Runs to the END of the day named, not to midnight at its start. An offer
       set to expire on the 30th and pulled at 00:00 on the 30th would be gone
       for the whole of the last day it was promised for. */
    ends.setHours(23, 59, 59, 999);
    return now <= ends;
}

/** Only the offers a visitor should see, in the order they were given. */
export function liveOffers<T extends { expiresAt?: string | null }>(offers: T[] | null | undefined, now = new Date()): T[] {
    return (offers || []).filter((o) => isOfferLive(o, now));
}
