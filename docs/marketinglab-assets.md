# MarketingLab direction: image assets

## Current status: generated treatments superseded

The user subsequently asked for the original website images to be restored. The generated motion hero, process portraits and edited footer sculpture documented below are no longer rendered by the rebuilt homepage, process section or footer. They remain on disk as historical assets; their presence is not an instruction to reintroduce them. The hero and process now use the original CMS images, service rows use the assigned CMS service artwork, and the footer uses Quadem's actual logo. No new images were generated for this correction. See `docs/original-images-motion-2026-09-19.md` for the current mapping.

Everything below records the earlier creation and inspection history, including its superseded application directions.

## Transparent footer sculpture

The cream footer uses a freestanding version of Quadem's existing blue glass loop sculpture. This is an image edit of the site's own decorative asset, not a MarketingLab image and not a newly substituted object.

- Edit target: `public/images/quadem-prop-2.webp` (1024 × 1024, with a baked black background).
- Built-in Imagegen edit output: `/Users/macbookpro/.codex/generated_images/01a0acde-e126-7010-ace0-0157b07c6336/exec-de3686e4-5175-405a-817d-301923b98afa.png`.
- Workspace source PNG: `public/images/quadem-footer-sculpture.png`, 1254 × 1254, genuine RGBA transparency.
- Production alpha WebP: `public/images/quadem-footer-sculpture.webp`, 600 × 600, **92,562 bytes**.
- Encoding only: Sharp resize to 600px wide without enlargement, WebP quality 88, alphaQuality 100, effort 6. No manual background removal or recolouring was used.
- Alpha verification: source has 722,668 fully transparent pixels, 849,137 partially transparent pixels and 711 fully opaque pixels. It is not a painted checkerboard or a black rectangular backdrop. The edited glass shape, blue reflections and transparent negative spaces were visually inspected; encoded WebP was also viewed.
- Usage: decorative empty alt, `object-fit: contain`, no background panel. Keep a small clear margin around the object. This image is decorative artwork, not evidence of business results.

### Exact footer edit prompt

```text
Use case: background-extraction
Asset type: transparent decorative blue glass sculpture for a cream website footer.
Input image: Image 1 is the edit target, Quadem's existing blue glass loop sculpture on a black background.
Primary request: Remove only the black background and return the same sculpture on a genuinely transparent background with an alpha channel. Preserve the exact intertwined loop shape, orientation, crop scale, central position, reflective dark cobalt glass material, cyan highlights and fine glass reflections. The empty negative spaces between and through the loops must also be transparent where they show the old black background.
Constraints: Keep the sculpture recognisably the same object with its blue glass material intact. Preserve smooth antialiased edges. Do not replace it with a new object. Do not retain a black rectangle, black background haze or square halo. No white or cream backdrop, no checkerboard painted into the image, no floor or cast shadow, no text, no logo, no watermark. Output an actual transparent PNG; transparency must be alpha, not a visual imitation.
```


Created 19 September 2026. MarketingLab is now the primary visual and behavioural reference; the earlier Web-De asset arrangement is superseded. Quadem blue is retained.

## Original motion hero

- Production file: `public/images/marketinglab-blue-motion.webp`
- Public URL: `/images/marketinglab-blue-motion.webp`
- Dimensions: **1536 × 1024** (3:2). The prompt requested approximately 1920 × 1280; the built-in generator returned 1536 × 1024. No upscaling was applied.
- File size: **40,144 bytes**, WebP quality 84, effort 6, encoded with the repository's Sharp package.
- Source PNG: `/Users/macbookpro/.codex/generated_images/01a0acde-e126-7010-ace0-0157b07c6336/exec-00265f5e-8658-45e0-8474-4041aca8b8e1.png` (1,913,973 bytes). The original remains in place.
- Generation mode: **built-in Imagegen**, single original generation. No CLI/API fallback.
- Input images: **none**. The reference screenshot was inspected for composition, but no MarketingLab artwork was uploaded, recoloured or copied.
- Classification: **decorative AI-generated concept photography**. The anonymous person is not Ernest, a Quadem employee, a customer or a documented event.
- Website alt: `alt=""` if rendered as an image; no alternative text is needed for a CSS background.
- Descriptive asset-library alt, if needed outside a decorative context: “An anonymous dark silhouette moving through electric blue light.”
- Inspection: both generated PNG and encoded WebP viewed. Central silhouette, horizontal light blur, saturated blue field and near-black lower area survived encoding. No visible text, logos or facial identity.

### Application and crop

Use the image as a full-bleed field behind the oversized hero typography. Preserve its broad blue light across the top and deep dark bottom. A normal desktop crop is `object-fit: cover` with `object-position: 50% 50%`. For portrait mobile, start with `50% 30%` and verify the head stays visible behind, not above, the type. The decisive feature is the human figure occupying the central field; do not put the image inside the previous right-hand rounded hero card.

The same source can support process panels through different CSS crops, without exporting or downloading duplicate files:

| Panel treatment | Initial crop | Visual result |
| --- | --- | --- |
| Left light field | `object-position: 12% 35%` | Mostly blue movement with the figure at the right edge |
| Central figure | `object-position: 50% 40%` | The clearest anonymous silhouette |
| Right light field | `object-position: 88% 35%` | Cyan motion and the figure at the left edge |

A crop is only visibly different when the rendered panel has a narrower ratio than the 3:2 source. Keep real process copy in HTML. Do not imply these three treatments show three different people or project stages.

### Exact generation prompt

```text
Use case: photorealistic-natural
Asset type: original decorative full-screen website hero background, wide 3:2 landscape, approximately 1920 x 1280.
Primary request: An original abstract long-exposure editorial photograph of one anonymous, unidentifiable human silhouette in the centre, surrounded by cobalt and electric blue light with cyan light scattering. The person's movement smears horizontally across the frame. A dark human head, shoulders and torso remain recognisable only as a soft silhouette, with no discernible face or identity.
Scene/backdrop: Seamless broad field of saturated blue light with photographic grain and soft lens diffusion; deep inky shadows fall towards the bottom and lower corners. No identifiable room or objects.
Composition/framing: Large central human figure beginning near the upper third and extending below the lower edge. Broad saturated blue negative space across the upper half and to both sides supports a very large headline added later in HTML. Keep the image expansive and immersive with naturally uneven photographic light, not a flat digital gradient. The bottom quarter is much darker so small white UI copy can be legible over it.
Style/medium: Photorealistic experimental editorial photography, intentional slow-shutter horizontal motion blur, raw fine film grain, dramatic but restrained. Not a 3D render, not an illustration.
Colour palette: Quadem electric blue and rich cobalt, small cyan light streaks, deep near-black/navy shadows. No orange, red, pink or purple.
Text: None.
Constraints: Produce a new original composition; this is decorative concept photography, not a portrait of Quadem staff. No text, no typography, no logos, no watermark, no UI, no symbols, no dashboard, no graphs, no sharp facial details, no extra people or props.
```

## Three supporting values and commitment treatments

These choices keep the large photographic and image-led blocks grounded in Quadem's real work. They were viewed independently for this correction. They require no additional image generation.

| Suggested theme | Image and classification | Treatment and truthful usage |
| --- | --- | --- |
| Direct collaboration | `https://cms.quademdigital.com/api/media/file/founder-portrait.webp`, actual founder portrait | Native 857 × 1200 portrait, or a 4:5 crop centred around 42% 20%. Alt: “Ernest Avorwlanu, founder of Quadem Digital.” Suitable beside a direct-contact commitment. Keep the image natural; avoid generated team shots and avoid presenting the decorative hero silhouette as Ernest. |
| A consistent identity | `https://cms.quademdigital.com/api/media/file/qd-identity-cover.webp`, **internal** brand work | 1600 × 1063. Native ratio or 3:2, centred, so cards, letterhead and colour samples remain visible. Alt: “Quadem Digital business cards, brochure, letterhead and colour palette.” Suitable beside a commitment to consistent presentation. Caption it as Quadem's own identity, not client work. |
| Practical improvements | `https://cms.quademdigital.com/api/media/file/cover-omek-storefront.webp`, **client project, build in progress** | 1600 × 1000. Keep the 8:5 screen ratio and the shop name; use the image within a generous full-width or half-width editorial block. Alt: “Omek Gigs Appliance storefront homepage.” Link to `/projects/omek-storefront/`. The screenshot demonstrates the storefront, not a revenue or conversion claim. Any numeric result must be separately supported by the case study. |

For large selected-work panels, retain the SAN cover as the second real client example:

- `https://cms.quademdigital.com/api/media/file/cover-san-collection.webp`
- 1600 × 1000, 8:5; classification **client project, build in progress**.
- Alt: “SAN Collection storefront showing a black handbag.”
- Keep the source's gold and black colours inside the image. Quadem's blue governs the containing website, not the client's own artwork.

These CMS images were already published by Quadem for its site and remain in that existing context. No additional ownership, licence, customer endorsement or team claim is inferred. The earlier `docs/rebuild-asset-manifest.md` remains useful for exact project classifications and original asset sources, but its blue sculpture hero recommendation is no longer current.

## Distinct process portraits

The process sequence now uses three additional original portraits, followed by a central crop of the original hero for panel four. This replaces the earlier suggestion to repeat the same silhouette with alternate crops. Each portrait was generated in its own built-in Imagegen call with no input image, then resized from 1024 × 1536 to 768 × 1152 and encoded as WebP (quality 84, effort 6) with Sharp. No face editing or photographic recolouring was performed after generation. All three encoded files were visually checked.

| Process asset | Subject | Encoded size |
| --- | --- | --- |
| `public/images/marketinglab-process-1.webp` | Anonymous long-haired frontal silhouette | 35,970 bytes |
| `public/images/marketinglab-process-2.webp` | Anonymous short-haired, left-facing side profile | 19,900 bytes |
| `public/images/marketinglab-process-3.webp` | Anonymous back-facing figure with swept hair and shoulders | 32,092 bytes |

All three are decorative concept photography, not staff, customer or event evidence. Use empty alt text when they sit behind process copy. The 2:3 originals should fill portrait panels with `object-fit: cover; object-position: 50% 50%`; their lower thirds are deliberately dark. Keep the content and numbers in HTML.

### Process 1: source and exact prompt

Source PNG retained at `/Users/macbookpro/.codex/generated_images/01a0acde-e126-7010-ace0-0157b07c6336/exec-8133b3f3-5da1-4e7e-98f2-c9cdeaa51fad.png`.

```text
Use case: photorealistic-natural
Asset type: original decorative website process-panel photograph, portrait 2:3 composition.
Scene/backdrop: Expansive cobalt and electric blue light, cyan traces, deep near-black/navy shadows towards the bottom. Seamless abstract photographic background, no identifiable room or objects.
Style/medium: Photorealistic experimental editorial photography with intentional slow-shutter horizontal motion blur, fine film grain and soft lens diffusion. Dramatic and restrained. Not a 3D render or illustration.
Colour palette: Quadem electric blue, cobalt, cyan and near-black navy only. No orange, red, pink or purple.
Composition: One large anonymous human silhouette in a portrait frame. Keep the bottom third dark and visually simple for overlaid white process copy added later in HTML. Preserve the shape of the person despite the broad horizontal motion trails.
Text: None.
Constraints: Entirely original image. Decorative AI-generated concept photography, not a portrait of Quadem staff or a real customer. No text, typography, logos, watermark, UI, symbols, identifiable facial detail, extra people or props.
Subject: One anonymous long-haired figure, seen from the front with head slightly lowered. Long hair and shoulders are carried into wide horizontal blue motion trails. The face is entirely an indistinct dark shape. The upper silhouette sits slightly left of centre and the broadest light trails flow right. Allow the long hair outline to remain different from a short-haired portrait.
```

### Process 2: source and exact prompt

Source PNG retained at `/Users/macbookpro/.codex/generated_images/01a0acde-e126-7010-ace0-0157b07c6336/exec-2b15fc1d-3a41-47ea-8a4d-4c7fd6bcbd47.png`.

```text
Use case: photorealistic-natural
Asset type: original decorative website process-panel photograph, portrait 2:3 composition.
Scene/backdrop: Expansive cobalt and electric blue light, cyan traces, deep near-black/navy shadows towards the bottom. Seamless abstract photographic background, no identifiable room or objects.
Style/medium: Photorealistic experimental editorial photography with intentional slow-shutter horizontal motion blur, fine film grain and soft lens diffusion. Dramatic and restrained. Not a 3D render or illustration.
Colour palette: Quadem electric blue, cobalt, cyan and near-black navy only. No orange, red, pink or purple.
Composition: One large anonymous human silhouette in a portrait frame. Keep the bottom third dark and visually simple for overlaid white process copy added later in HTML. Preserve the shape of the person despite the broad horizontal motion trails.
Text: None.
Constraints: Entirely original image. Decorative AI-generated concept photography, not a portrait of Quadem staff or a real customer. No text, typography, logos, watermark, UI, symbols, identifiable facial detail, extra people or props.
Subject: One anonymous short-haired person in clear side profile facing left. The forehead, nose, chin and neck read only as a soft near-black contour, with no eyes or facial texture. Cyan light slices across the background and smears the profile horizontally. Place the person's outline just right of centre, with blue open space in front of the profile.
```

### Process 3: source and exact prompt

Source PNG retained at `/Users/macbookpro/.codex/generated_images/01a0acde-e126-7010-ace0-0157b07c6336/exec-d59eaae2-e0e0-4427-b967-28e1c4be39f6.png`.

```text
Use case: photorealistic-natural
Asset type: original decorative website process-panel photograph, portrait 2:3 composition.
Scene/backdrop: Expansive cobalt and electric blue light, cyan traces, deep near-black/navy shadows towards the bottom. Seamless abstract photographic background, no identifiable room or objects.
Style/medium: Photorealistic experimental editorial photography with intentional slow-shutter horizontal motion blur, fine film grain and soft lens diffusion. Dramatic and restrained. Not a 3D render or illustration.
Colour palette: Quadem electric blue, cobalt, cyan and near-black navy only. No orange, red, pink or purple.
Composition: One large anonymous human silhouette in a portrait frame. Keep the bottom third dark and visually simple for overlaid white process copy added later in HTML. Preserve the shape of the person despite the broad horizontal motion trails.
Text: None.
Constraints: Entirely original image. Decorative AI-generated concept photography, not a portrait of Quadem staff or a real customer. No text, typography, logos, watermark, UI, symbols, identifiable facial detail, extra people or props.
Subject: One anonymous figure turned completely away from the camera, the back of the head and shoulders visible. Wind and slow-shutter movement stretch the hair and shoulder edges horizontally through electric blue light. The back-facing posture and broad shoulder line must be distinct from a frontal portrait or a side profile. No face visible.
```
