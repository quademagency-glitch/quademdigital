## Section 07: Proof

**Extended, 2 September 2026.** Fieldwork has now been run twice for a paying client, a
delivery and logistics operator in Accra. The section keeps its heading, "Where you can
watch it run", and keeps the crawl study. What is new is the Accra engagement, added in
front of the crawl study because it is the service itself rather than the service pointed
at a market.

**The client proof is still TODO and still must not be invented.** The spec wants how many
businesses were found, how many replied and how many became clients. Found now exists.
Replied and became clients do not, because the client has reported no outcomes back. The
section says that in its own first sentence rather than letting a reader assume otherwise.
When the outcomes arrive they go in, alongside the line "I built it for my own agency
first, and it is how I found you."

**Four rules bind this section. They do not expire when the outcomes arrive.**

1. **The client is not named.** Permission to name has not been given in writing. The
   agreed wording is "a delivery and logistics operator in Accra" and it holds until that
   permission exists. If the client is later named but withdraws, this wording is the
   fallback, which is why point 4 of the permission email asks for sector rights
   separately.

2. **No business from any list appears here.** Not by name, not by handle, not by phone
   number, not as an anonymised example that could be identified from its description. The
   lists are the client's paid asset, and they carry personal contact data covered by the
   Data Protection Act 2012. Publishing them would hand away the thing the client bought.
   This rule survives being given permission to name the client, because it is not the
   client's permission to give.

3. **Every figure is counted, not estimated.** The sources are the delivered workbooks in
   `docs/fieldwork/`, where the totals are live formulas rather than typed numbers. If a
   figure on the page cannot be traced to a cell in one of those files, it does not belong
   on the page.

4. **Do not write "seven out of ten".** An earlier draft of the portfolio plan used that
   line. The candidate pool does not support it. Of 49 businesses sourced in week one, 18
   were sent and 31 were dropped, which is closer to six in ten than seven. The same
   over-claim reached the client on the week one sheet and is corrected from week three
   onward.

**The figures the section is allowed to state, as at 2 September 2026:**

| Figure | Value | Source |
| --- | --- | --- |
| Sourced, week one | 49 | `week1-pass-candidates.csv`, row count |
| Sent, week one | 18 | `Fieldwork-Accra-Delivery-Week1.xlsx`, `COUNTA` on the Leads tab |
| Dropped, week one | 31 | 49 minus 18 |
| Delivered, both weeks | 40 | 18 plus 22, and the tracker's Both weeks tab |
| Reachable on WhatsApp | 36 of 40 | `COUNTIF` on both Leads tabs |
| Repeats | 0 | `exclusion-list.csv`, 76 names, checked before each build |

**One further thing the section carries, and should keep carrying: the miss.** In week one
a beauty wholesaler was held back on an eight month old signal. In week two it was found
trading actively under a separate wholesale account and turned out to be the strongest
prospect in the pool. Checking for a second account before writing a business off is now
part of the routine. A method that never reports its own misses is a claim rather than a
method, and this page is sold on the difference.

**The crawl study link stays**, in both directions, exactly as this section previously
asked. Once `docs/crawl-findings-2026-08-21.md` is published as analysis piece 01, that
link points at it too.
