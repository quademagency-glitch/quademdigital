# Featured work on phones and tablets, 23 September 2026

Release update: these fixes are included in production deployment
`dpl_AmRTx9CoQX8Q4Wu5ooua9xnYZUw6`, READY and assigned to quademdigital.com.
The combined release also includes enquiry-form fallback fixes. See
[the release report](site-resume-2026-09-23.md). No commit or push was made.

Ernest asked how the site renders on mobile, tablets and other small screens,
and named the featured work section in particular.

## What was wrong

The section was broken on every phone and tablet, and it was broken on the live
site, not only locally.

- Project titles read one letter per line. "Omek Storefront" ran fifteen letters
  straight down the card.
- The third and fourth cards showed no title at all. The words were clipped away
  entirely, leaving a thumbnail, "Internal project" and a category.
- Cards that should have matched were 331, 306, 583 and 406 pixels tall, because
  each title's height depended on how many letters it had.
- The thumbnail was a square holding a picture shaped 1.6 to 1, so a third of the
  box was empty, and the picture itself was clipped at the bottom.

## Why it happened

The motion script wraps the text of every heading so the words can slide in. It
used `<span>` to do that.

Headings on this site often already contain a deliberate span, and the
stylesheets name it loosely. Three rules were written for one span and, from the
moment the script ran, applied to two:

| Rule | Written for | Also hit |
| --- | --- | --- |
| `.studio-work-mobile-preview ... h3 a>span { flex: 0 0 18px }` | the diagonal arrow | the whole title, squeezed to 18px |
| `.studio-work-info h3 a>span { transition: transform }` and its hover pair | the arrow | the title moved on hover too |
| `.studio-expect-grid span { display: block; font-size: 13px }` | the "01" number on About | both words of every value heading |

The last one applied at every width, so the About page headings were wrong on
desktop as well.

Separately, `picture { display: contents }` is set on several wrappers so the
`<img>` becomes the direct grid or flex child. That also promotes the two
`<source>` siblings to items. They paint nothing, but they are still items, so
each `gap` on the wrapper was counted once per source. Two sources on a 14px gap
pushed the thumbnail 28px down inside a box that clips, and cut its bottom off.
On desktop the same fault added 36px of empty space above every work image.

## Why the previous checks passed

`docs/qa/homepage-mobile-density-checks.py` sets `quadem-motion` to `paused`
before it loads the page. That is the only setting in which this bug does not
happen, because the wrapper is never created. All 92 checks passed against the
one configuration that hides it.

Measured on the running site, the title height was 44px with motion paused and
252px in every other state, including a device asking for reduced motion, which
this site deliberately ignores. The suite's own evidence file records title
heights of 34 to 76 pixels, so it never saw what a visitor sees.

The checks also looked for overflow and clipping. A title squeezed to 18px
overflows nothing. It fits perfectly and reads as nonsense.

## What I changed

- The three loose selectors now name the span they meant: `[aria-hidden="true"]`
  for the arrow, `article > span` for the number.
- The motion wrappers are no longer spans. They are `story-run`, `story-mask`
  and `story-word`, which are ordinary inline boxes that no rule written for real
  content can reach by accident. Styling is still by class, so every stylesheet
  rule and every existing check that names `.story-word` works unchanged.
- `picture > source { display: none }` in the base stylesheet, so a source never
  takes part in layout anywhere.
- The mobile thumbnail is now shaped like the artwork, 1.6 to 1, and wider:
  `clamp(88px,38%,176px)`. Below 380px it gives width back to the title and the
  title steps down to 19px.
- The `sizes` hint on the cover follows the new box, so the browser still picks
  a sharp copy.
- The section intro said "what we built". Quadem is one person. It says "I" now.

## What I measured

Chromium, against the running site, motion on, which is the default a visitor
gets.

| | before | after |
| --- | --- | --- |
| Title height, all four cards at 390px | 252, 227, 504, 327px | 44, 44, 50, 50px |
| Card heights at 390px | 331, 306, 583, 406px | 123, 123, 129, 129px |
| Picture drawn at 390px | 95x67 in a 95x95 box | 121x76 in a 121x76 box |
| Picture area at 390px | 6,365px² | 9,196px², 44% more |
| Thumbnail offset inside its box | 28px down, bottom clipped | 0 |
| Desktop work image offset | 120px from the top | 84px |

Checked at 320, 375, 390, 412, 430, 744, 768, 820, 1024 and 1440px. No
horizontal overflow anywhere, before or after. Every rule that could reach the
motion wrappers was listed by matching every stylesheet rule against them on 18
routes at three widths; only the universal `*` reset remains, which is meant to
apply to everything.

The word reveal still animates: `--word-reveal` goes 0 to 1 on scroll, 171 words
wrap on the homepage, none nested, no console errors.

`check:copy`, `check:theme`, `check:csp`, `check:global`, `check:blog`,
`check:markets` and `check:images` all pass. `astro build` completes.

## Still open

Headings grow 9 to 15 pixels once the motion script runs, at every width. A
24px service heading becomes 33px. Nothing is broken by it, but the page settles
after it paints. I tried five candidate fixes at the mask level and none of them
moved the number, so the cause is further in than the wrapper. Left alone and
recorded here rather than guessed at.

## Shipped

Deployed to production on 2026-09-23 as `dpl_EqKBTpVTFHek3tftEW6kFxmA2XZL`,
aliased to quademdigital.com. Measured live afterwards at 390px: titles 44, 44,
50 and 50px, cards 123 to 129px, the picture filling its box with no offset, and
the wrappers rendering as `story-run`. The About headings are 34px at 390px and
1440px, and the "01" number still has its own styling, so the leak closed
without breaking what the rule was written for. Eleven routes answer 200.

Because the same deploy carried four unshipped files from the evening of
2026-09-22 that harden lead capture, they were tested first against a stub CMS
that proxied reads to production and intercepted every write, with an invalid
Resend key. No record was created and no email was sent.

- Contact wizard, all three steps: the lead is created at step 2, a token comes
  back, step 3 saves budget, services, message and answers. The visitor sees the
  thanks message. No console errors.
- Service enquiry form on a service page: same, through to "Send enquiry".
- Enrichment with no token, and with a token issued for a different address:
  both refused with 403, which is the point of the change.
- No-JavaScript form post: 303 to the page it came from with `?sent=1`. A
  `returnTo` pointing off site is refused and falls back to `/contact/`.

One transition case worth knowing: a visitor who had the wizard open from before
the deploy and finished it after would send no token and get a 403 on the final
step. Their step 2 enquiry, name, email, services and message, is already saved,
so nothing is lost, but the last details would not attach. The window for that
closed when the deploy finished.

The email sending path was not exercised, because Resend was deliberately given
an invalid key. Sends are best effort in this route and the form still reported
success, so a mail failure does not cost a lead.

## Still not in git

None of this is committed. `WorkCard.astro`, `story-motion.js`, `studio.css`,
`studio-motion.css` and `visual-story.css` are untracked, and the class the live
homepage uses, `studio-work-mobile-preview`, appears in no commit on any branch.
The live site is a rebuild that exists only in this working tree and reaches
production through the Vercel CLI, not a push.

That is worth fixing on its own account. Committing it is a decision about
roughly 130 files of another session's unfinished work going into a public
repository, so it was left for Ernest rather than done here.
