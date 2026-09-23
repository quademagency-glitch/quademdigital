# MarketingLab behaviour adaptation

The user supplied https://marketinglab.framer.ai/ as a new reference for how Quadem's pages behave. This is an interaction extension to the completed public-site rebuild, retaining Quadem blue, original assets, real content and the CMS-backed commercial flows.

## Reference inspection

Inspected the rendered homepage and services, work and about pages in Chromium, including scrolling, control states and mobile layouts. The reference's distinctive sequences are a process row whose cards arrive and stick in order, and case studies that rise over earlier panels beneath a retained heading. It also uses entrance movement, vertically rolling CTA labels, compact service rows and open/closed FAQ states. The source's work archive repeats the stacking pattern.

Quadem adapts those patterns to its existing content. The reference's service presentation has one expanded lead row and condensed alternatives; Quadem gives every service an explicit, keyboard-accessible disclosure. Reference imagery, project counts, testimonial claims and placeholder FAQ answers are not imported.

## Implementation

- `src/styles/studio-motion.css` supplies the shared responsive interaction layer.
- `src/scripts/studio-motion.js` owns entrances, rolling anchor labels, disclosure state, desktop menu behaviour and project recession. It cancels animations, observers and listeners before Astro swaps the page.
- Homepage process cards enter a four-column sticky row, using the actual CMS steps. Project panels stack on the homepage and archive, retaining real project classifications and detail links.
- `src/components/ServiceDisclosure.astro` supplies native service disclosures for both the homepage and full service listing. CMS descriptions, highlights, regional starting prices and booking links remain present.
- FAQs open with an interrupted-safe expansion. The currently selected question remains keyboard accessible, and opening a service keeps its heading clear of the fixed navigation.
- Desktop Explore supports hover, click, outside-click dismissal and Escape. The existing accessible mobile drawer is preserved.
- Primary link labels roll on hover/focus; mutable form submission labels are not wrapped. Duplicate visual labels are hidden from accessibility APIs.

## Behaviour limits

There is no scroll hijacking or new animation dependency. Sticky sequences are reserved for viewports at least 1000px wide and 760px high, with a runtime check that every card fits. Mobile, short screens, reduced motion and no-JavaScript visitors retain readable flow and native controls. Changing the motion preference while the page is open immediately cancels motion and restores flow.

The hero and footer receive bounded entrances, rather than hiding every section until a script runs. Project recession is at most 4.5%; it does not fade text while the visitor reads it. Existing light-mode tokens remain in use.

## Verification and publication

The browser passes cover hover labels, menu dismissal, exclusive services and FAQs, rapid repeated activation, native scroll positions, project filters across Astro navigation, mobile touch layouts, light mode, reduced-motion changes and no-JavaScript controls. The correction pass confirms heading clearance, content-fit guards, intermediate viewports, direct service anchors and the international shell. All twelve final behavioural checks passed. A development-toolbar module failed during Vite dependency re-optimisation; the subsequent clean reload and client navigation returned no JavaScript page errors.

The final production build passed, as did all ten repository release guards and all nine business-audit regression tests. The existing unused docx-import build warning remains. This does not claim a clean repository-wide TypeScript check. Evidence: [QA results](qa/marketinglab-behaviour-2026-09-19.json).

No production deployment, CMS write, real enquiry or email submission is part of this work. The local preview is http://127.0.0.1:4322/.
