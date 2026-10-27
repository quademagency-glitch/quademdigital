// The brands we have built for (Ernest, 26 Oct 2026: a strip "scrolling
// nonstop", no heading, faded until clicked; Omek, Quajo Speaks, QuadERP and
// ElimHQ). Shown along the bottom of the home page hero and under About's
// promise. Files in /public/images/brands, 120px tall with transparent
// backgrounds, from each brand's own logo files. `h` balances them by eye: a
// wide wordmark at full height outweighs a compact one.
export const BRANDS = [
  { key: 'omek', name: 'Omek Gigs Appliances', src: '/images/brands/omek.webp', w: 356, h: 1 },
  { key: 'quajo-speaks', name: 'Quajo Speaks', src: '/images/brands/quajo-speaks.webp', w: 316, h: 1.06 },
  { key: 'quaderp', name: 'QuadERP', src: '/images/brands/quaderp.webp', w: 790, h: 0.67 },
  { key: 'elimhq', name: 'ElimHQ', src: '/images/brands/elimhq.webp', w: 618, h: 0.76 },
];
// Four copies in one track that slides by half its length, so the loop has no seam.
export const BRAND_COPIES = [0, 1, 2, 3];
