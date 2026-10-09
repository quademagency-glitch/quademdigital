/**
 * The page a prospect opens for a video pitch: quademdigital.com/pitch/<slug>/.
 *
 * Recorded in the team portal and prepared by the CMS (cms/src/lib/pitchVideos.ts).
 * The route (src/pages/pitch/[...slug].ts) asks the CMS for short-lived signed
 * links to the video, its poster and the slides, and hands them to this.
 *
 * One fixed look on purpose: paper and ink, the same as the quotation and
 * signing pages, which a prospect may well see next. No analytics, no chat
 * widget: the address is the prospect's private link. Every value from the CMS
 * is escaped, because the note and the business name are typed by people.
 *
 * The player counts how much was watched, each second once, so skipping to the
 * end is not "watched it all". It tells the CMS when they start, and at a
 * quarter, half, three quarters and the end, once per visit; nothing when the
 * sender previews with ?preview=1.
 */

export type VideoLinks = {
  ready: boolean;
  status?: string;
  title?: string | null;
  business?: string | null;
  message?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  slides?: { n: number; at: number }[];
  mp4?: string;
  poster?: string | null;
  download?: string;
  deck?: string | null;
  sender?: { name: string; firstName: string; whatsapp: string | null };
};

const SITE = 'https://quademdigital.com';

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 2:10, or 1:02:10 past the hour. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** "6 min", or "under a minute". */
export function length(seconds: number | null | undefined): string {
  if (!seconds) return '';
  if (seconds < 60) return 'under a minute';
  return `${Math.round(seconds / 60)} min`;
}

/** A WhatsApp chat with the sender, the message already written. */
export function whatsappLink(number: string | null | undefined, text: string): string | null {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const ROBOTS = 'noindex, nofollow, noarchive';

const STYLE = `
  @font-face { font-family: 'Urbanist'; src: url('/fonts/urbanist/urbanist-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
  :root {
    --paper: #f2efe8; --card: #ffffff; --ink: #0b1220; --muted: #5b6474; --line: #e2ddd2;
    --accent: #00aeef; --stage: #0b1220; --wa: #128c4a; --wa-hover: #0f7a40;
    --radius: 18px; --font: 'Urbanist', 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font); -webkit-text-size-adjust: 100%; }
  body { min-height: 100vh; line-height: 1.55; }
  a { color: inherit; }
  button { font: inherit; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; max-width: 1000px; margin: 0 auto; }
  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 700; }
  .brand img { width: 30px; height: 30px; border-radius: 8px; }
  .secure { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 6px 16px 56px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .wrap > * { min-width: 0; }
  .intro h1 { font-size: clamp(27px, 4.4vw, 40px); line-height: 1.12; letter-spacing: -0.015em; margin: 0 0 6px; text-wrap: balance; }
  .intro p { margin: 0; color: var(--muted); font-size: 16px; }
  .stage { background: var(--stage); border-radius: var(--radius); overflow: hidden; margin-inline: auto; width: min(100%, calc(78vh * var(--ratio))); aspect-ratio: var(--ratio); box-shadow: 0 18px 50px -24px rgba(11, 18, 32, 0.55); }
  .stage video { display: block; width: 100%; height: 100%; background: var(--stage); object-fit: contain; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; }
  .kicker { font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
  .chapters ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 8px; }
  .chapters button { width: 100%; text-align: left; cursor: pointer; background: #f7f5f0; color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 1px; min-height: 48px; transition: border-color .15s, background-color .15s; }
  .chapters button:hover { border-color: #c9c2b4; }
  .chapters button b { font-size: 15px; }
  .chapters button span { font-size: 13.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .chapters button[aria-current="true"] { background: #e6f6fd; border-color: var(--accent); }
  .note p.say { margin: 0; font-size: 17.5px; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 68ch; }
  .note .who { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; }
  .note .who span.i { width: 34px; height: 34px; border-radius: 50%; background: var(--ink); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 15px; flex: none; }
  .note .who b { font-size: 15px; }
  .note .who small { display: block; color: var(--muted); font-size: 13.5px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .btn { appearance: none; border: 1px solid transparent; cursor: pointer; border-radius: 999px; padding: 12px 22px; font-weight: 700; font-size: 16px; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; text-decoration: none; transition: background-color .15s, border-color .15s; }
  .btn svg { flex: none; }
  .btn.wa { background: var(--wa); color: #fff; }
  .btn.wa:hover { background: var(--wa-hover); }
  .btn.ink { background: var(--ink); color: #fff; }
  .btn.ink:hover { background: #1c2740; }
  .keep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; font-size: 15px; color: var(--muted); }
  .keep a { color: var(--ink); font-weight: 700; display: inline-flex; align-items: center; gap: 6px; text-underline-offset: 3px; }
  footer { max-width: 1000px; margin: 0 auto; padding: 0 16px 32px; color: var(--muted); font-size: 13.5px; }
  @media (max-width: 560px) {
    .actions .btn { flex: 1 1 100%; }
    .card { padding: 16px; }
    /* One row to swipe on a phone, so the buttons below stay near the video. */
    .chapters ol { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 112px; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 6px; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; }
    .chapters li { scroll-snap-align: start; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>`;
const WA = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5.1 5.2-1.36A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.09.81.83-3.01-.2-.31a8.2 8.2 0 1 1 6.94 3.83Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.17.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.34-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04c0 1.2.88 2.37 1 2.53.12.16 1.73 2.64 4.19 3.7 1.56.67 2.17.73 2.95.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.16-.47-.28Z"/></svg>`;
const CAL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`;
const DOWN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`;

const head = (title: string, extra = '') => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="${ROBOTS}">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#f2efe8">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico">
<link rel="preload" href="/fonts/urbanist/urbanist-latin.woff2" as="font" type="font/woff2" crossorigin>
${extra}<style>${STYLE}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="${SITE}/" rel="noreferrer"><img src="/images/logo-104.webp" alt="" width="30" height="30">Quadem Digital</a>
  <span class="secure">${LOCK}Private video link</span>
</header>
`;

const player = (slug: string, duration: number) => `<script>
(function () {
  var v = document.getElementById('v');
  if (!v) return;
  var slug = ${JSON.stringify(slug).replace(/</g, '\\u003c')};
  var quiet = location.search.indexOf('preview=1') !== -1;
  var once = function (k) {
    try { if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); } catch (e) {}
    return true;
  };
  var send = function (q) {
    if (quiet) return;
    try { fetch('/api/pitch-view/?slug=' + encodeURIComponent(slug) + q, { method: 'POST', keepalive: true }).catch(function () {}); } catch (e) {}
  };

  // Where to start: ?t=125 after the links were refreshed, or #t=125 in a shared link.
  var start = /[?&#]t=(\\d+)/.exec(location.search + location.hash);
  if (start) {
    var seek = function () { v.removeEventListener('loadedmetadata', seek); v.currentTime = +start[1]; };
    v.addEventListener('loadedmetadata', seek);
  }

  v.addEventListener('play', function () { if (once('qd-v-play:' + slug)) send('&event=play'); });

  // Each second watched counts once: skipping ahead is not watching.
  var seen = {}, count = 0, marks = [25, 50, 75, 100];
  var check = function (ended) {
    var d = Math.floor(v.duration && isFinite(v.duration) ? v.duration : ${Math.floor(duration) || 0});
    if (!d) return;
    var p = (count / d) * 100;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var reached = m === 100 ? p >= 90 && (ended || p >= 98) : p >= m;
      if (reached && once('qd-v-' + m + ':' + slug)) send('&event=progress&p=' + m);
    }
  };

  var chapters = [].slice.call(document.querySelectorAll('[data-at]'));
  var strip = document.querySelector('.chapters ol'), last = null;
  var mark = function () {
    var t = v.currentTime, current = null;
    chapters.forEach(function (b) { if (+b.getAttribute('data-at') <= t + 0.25) current = b; });
    if (current === last) return;
    last = current;
    chapters.forEach(function (b) { b.setAttribute('aria-current', b === current ? 'true' : 'false'); });
    // On a phone the slides are one row: keep the one playing in view, without moving the page.
    if (current && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: current.parentNode.offsetLeft - 16, behavior: 'smooth' });
  };
  chapters.forEach(function (b) {
    b.addEventListener('click', function () {
      v.currentTime = +b.getAttribute('data-at');
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
      mark();
    });
  });

  v.addEventListener('timeupdate', function () {
    if (!v.seeking && !v.paused) {
      var s = Math.floor(v.currentTime);
      if (!seen[s]) { seen[s] = 1; count++; }
      check(false);
    }
    mark();
  });
  v.addEventListener('ended', function () { check(true); });

  // The links last six hours. One that has run out reloads the page at the same moment, which signs new ones.
  v.addEventListener('error', function () {
    if (!once('qd-v-reload:' + slug + ':' + Math.floor(Date.now() / 60000))) return;
    var q = '?t=' + Math.floor(v.currentTime || 0) + (quiet ? '&preview=1' : '');
    location.replace(location.pathname + q);
  });
})();
</script>`;

/** The page, once the video is ready. */
export function videoPage({ slug, links, bookingUrl }: { slug: string; links: VideoLinks; bookingUrl: string }): string {
  const business = links.business || '';
  const sender = links.sender ?? { name: 'Quadem Digital', firstName: 'Quadem', whatsapp: null };
  const first = sender.firstName || 'us';
  const heading = business ? `A video for ${business}` : links.title || 'A video for you';
  const ratio = links.width && links.height ? `${links.width} / ${links.height}` : '16 / 9';
  const mins = length(links.durationSeconds);
  const slides = (links.slides ?? []).filter((s) => Number.isFinite(s.n) && Number.isFinite(s.at));
  const wa = whatsappLink(sender.whatsapp, `Hi ${first}, I watched the video you sent${business ? ` for ${business}` : ''}.`);
  const description = links.message ? links.message.slice(0, 160) : `${sender.name} at Quadem Digital recorded this for you.`;
  const og = `<meta property="og:type" content="website">
<meta property="og:title" content="${esc(heading)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/pitch/${esc(slug)}/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
`;

  const chapterList =
    slides.length > 1
      ? `<section class="card chapters" aria-labelledby="ch">
    <p class="kicker" id="ch">Jump to a slide</p>
    <ol>${slides
      .map(
        (s) =>
          `<li><button type="button" data-at="${s.at}" aria-current="false" aria-label="Play from slide ${s.n}, at ${clock(s.at)}"><b>Slide ${s.n}</b><span>${clock(s.at)}</span></button></li>`,
      )
      .join('')}</ol>
  </section>`
      : '';

  const note = links.message
    ? `<section class="card note" aria-label="A note from ${esc(first)}">
    <div class="who"><span class="i" aria-hidden="true">${esc(first.slice(0, 1).toUpperCase())}</span><div><b>${esc(sender.name)}</b><small>Quadem Digital</small></div></div>
    <p class="say">${esc(links.message)}</p>
  </section>`
      : '';

  const keep = [
    links.download ? `<a href="${esc(links.download)}" rel="noreferrer">${DOWN}Download the video</a>` : '',
    links.deck ? `<a href="${esc(links.deck)}" rel="noreferrer">${DOWN}Download the slides (PDF)</a>` : '',
  ].filter(Boolean);

  return `${head(`${heading} · Quadem Digital`, og)}<main class="wrap" id="main">
  <section class="intro">
    <h1>${esc(heading)}</h1>
    <p>From ${esc(sender.name)} at Quadem Digital${mins ? ` · ${esc(mins)}` : ''}</p>
  </section>
  <div class="stage" style="--ratio: ${esc(ratio)}">
    <video id="v" controls playsinline preload="metadata"${links.poster ? ` poster="${esc(links.poster)}"` : ''} src="${esc(links.mp4)}">
      Your browser cannot play this video. <a href="${esc(links.download)}">Download it</a> instead.
    </video>
  </div>
  ${chapterList}
  ${note}
  <section class="actions" aria-label="Get in touch">
    ${wa ? `<a class="btn wa" href="${esc(wa)}" rel="noreferrer">${WA}WhatsApp ${esc(first)}</a>` : ''}
    <a class="btn ink" href="${esc(bookingUrl)}" rel="noreferrer">${CAL}Book a call</a>
  </section>
  ${keep.length ? `<p class="keep"><span>Keep a copy:</span>${keep.join('')}</p>` : ''}
</main>
<footer>Sent to you privately by Quadem Digital.</footer>
${player(slug, links.durationSeconds ?? 0)}
</body>
</html>`;
}

/** While the video is still being prepared: says so, and looks again every 30 seconds. */
export function videoHoldingPage({ links }: { links: VideoLinks }): string {
  const heading = links.business ? `A video for ${links.business}` : 'Your video';
  return `${head(`${heading} · Quadem Digital`, '<meta http-equiv="refresh" content="30">\n')}<main class="wrap" id="main">
  <section class="card intro">
    <h1>${esc(heading)}</h1>
    <p>It is nearly ready. This page will play it as soon as it is, in a minute or two.</p>
  </section>
</main>
</body>
</html>`;
}
