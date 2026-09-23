# Automatic regional pricing, 20 September 2026

The user requested removal of the “Pricing for / Automatic (Ghana)” box and
restoration of the existing continent rule throughout the site. This supersedes
the country selector described in the 19 September logo/motion/currency report.

## Behaviour

- African visitors use the independently configured GHS price list. Ghana sees
  its set amounts; other supported African currencies are converted from GHS.
- Visitors elsewhere use the independently configured USD price list, converted
  into the detected country's currency. US visitors see the set dollar amounts.
- Both sets remain in cached HTML; the private, uncached geo endpoint decides
  which set the browser displays. The local development preview defaults to Ghana
  only when edge country headers are absent. Production has no Ghana default.
- There is no country dropdown or saved choice. The retired localStorage key is
  cleared, and the geo endpoint ignores the retired country query parameter.
- Existing FX source, conversion fee, rounding, invoice policy, CMS prices,
  billing cycles and Ghana-only offer eligibility remain unchanged.
- Missing location keeps international USD prices. Failed or unusable exchange
  rates keep the selected list's base currency. Both conversion legs must be
  positive and finite, so calculators cannot label a base amount as local money.
  The client FX request now has an eight-second timeout.
- `/global/` retains its existing African-market link to the GHS packages rather
  than showing international USD-based packages to African visitors.

## Implementation

`src/scripts/pricing.js` no longer creates selector markup or reads country
choices. `src/lib/pricingLocation.js` resolves edge headers and the development
fallback only. `src/pages/api/geo.ts` no longer accepts country selection.
Selector CSS was removed from `src/styles/marketinglab.css`; DESIGN.md reflects
automatic pricing. All existing price cards, service entry prices, calculators
and enquiry budget bands continue through the shared engine.

## Verification

- Eight pricing unit tests passed, including all 58 entries in the African
  country/territory table, representative countries on other continents, retired
  overrides and independent GHS versus USD conversions.
- Existing market, live read-only CMS price and price-card audits passed.
- Production build passed in 33.59 seconds; JavaScript syntax and focused
  whitespace checks passed. The existing unused docx import warning remains.
- 88 browser assertions passed with actual geo endpoint responses using simulated
  edge headers and deterministic test exchange rates. Ghana, Nigeria and the UK
  were checked across 12 routes: home, service directory, all seven services,
  calculator, contact and global. Kenya, South Africa, Réunion, US, Germany,
  India, Australia and Brazil were also checked on Web Design.
- Calculator labels and both one-off/monthly totals passed for standard and
  expedited delivery. Missing GHS, zero target rate, negative GHS, FX outage and
  geo outage scenarios preserved consistent currencies and amounts.
- Old stored US overrides were ignored, country query overrides were ignored,
  and client-side navigation retained automatic pricing. No browser runtime errors.
- Pricing screenshots reviewed at 390px and 2560px; no horizontal overflow.
- Browser tests blocked analytics and non-GET/HEAD requests. No real form
  submissions, CMS mutations or deployment occurred.

Harness: `docs/qa/automatic-pricing-checks.py`.
Results: `docs/qa/automatic-pricing-2026-09-20.json`.
Screenshots: `docs/qa/automatic-pricing-mobile.png` and
`docs/qa/automatic-pricing-desktop.png`.

The existing country map covers 58 African countries/territories and 96 elsewhere.
Unsupported currencies or unavailable FX retain the appropriate base currency.
Country simulations verify the implementation, not production edge geolocation.
