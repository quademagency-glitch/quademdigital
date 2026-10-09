// Run with: npx tsx --test tests/pitch-video-page.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, esc, length, videoHoldingPage, videoPage, whatsappLink, type VideoLinks } from '../src/lib/pitchVideoPage.ts';

/*
  The page a prospect opens for a video pitch (src/lib/pitchVideoPage.ts).
  Everything in it that a person typed is escaped, the buttons appear only
  when there is somewhere for them to go, and nothing on it uses an em dash.
*/

const links: VideoLinks = {
  ready: true,
  title: 'Video for Evermark Homes',
  business: 'Evermark <Homes>',
  message: 'Hi Kofi,\nHere is the plan. <script>alert(1)</script>',
  durationSeconds: 372,
  width: 1920,
  height: 1080,
  slides: [{ n: 1, at: 0 }, { n: 2, at: 31.5 }, { n: 4, at: 130 }],
  mp4: 'https://bucket.s3.amazonaws.com/v.mp4?X-Amz-Signature=a&b=1',
  poster: 'https://bucket.s3.amazonaws.com/p.jpg?sig=1',
  download: 'https://bucket.s3.amazonaws.com/v.mp4?response-content-disposition=attachment',
  deck: 'https://bucket.s3.amazonaws.com/d.pdf?x=1',
  sender: { name: 'Ama Mensah', firstName: 'Ama', whatsapp: '233240001111' },
};

test('clock and length read like a person would say them', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(130.9), '2:10');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(length(45), 'under a minute');
  assert.equal(length(372), '6 min');
  assert.equal(length(null), '');
});

test('the WhatsApp button opens a chat with the sender, the message written', () => {
  assert.equal(whatsappLink('+233 24 000 1111', 'Hi Ama'), 'https://wa.me/233240001111?text=Hi%20Ama');
  assert.equal(whatsappLink('', 'x'), null);
  assert.equal(whatsappLink('123', 'x'), null);
});

test('the page: escaped, with the player, chapters, note, buttons and downloads', () => {
  const html = videoPage({ slug: 'evermark-homes-ab12', links, bookingUrl: 'https://calendly.com/quademdigitalenterprise/free-strategy-call' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<h1>A video for Evermark &lt;Homes&gt;</h1>'));
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow, noarchive">'));
  assert.ok(html.includes('<meta property="og:image" content="https://quademdigital.com/pitch/evermark-homes-ab12/preview.jpg">'));
  assert.ok(html.includes('src="https://bucket.s3.amazonaws.com/v.mp4?X-Amz-Signature=a&amp;b=1"'));
  assert.ok(html.includes('playsinline'));
  assert.ok(html.includes('--ratio: 1920 / 1080'));
  assert.ok(html.includes('From Ama Mensah at Quadem Digital · 6 min'));
  assert.equal((html.match(/data-at="/g) || []).length, 3);
  assert.ok(html.includes('data-at="130" aria-current="false" aria-label="Play from slide 4, at 2:10"><b>Slide 4</b><span>2:10</span>'));
  assert.ok(html.includes(`href="https://wa.me/233240001111?text=${esc(encodeURIComponent('Hi Ama, I watched the video you sent for Evermark <Homes>.'))}"`));
  assert.ok(html.includes('WhatsApp Ama'));
  assert.ok(html.includes('Book a call'));
  assert.ok(html.includes('Download the video'));
  assert.ok(html.includes('Download the slides (PDF)'));
  assert.ok(!html.includes('—'), 'no em dashes');
});

test('no chapters for a single slide or none, no WhatsApp without a number, no slides link when not allowed', () => {
  const html = videoPage({
    slug: 'x',
    links: { ...links, slides: [{ n: 1, at: 0 }], message: null, deck: null, sender: { name: 'Quadem Digital', firstName: 'Quadem', whatsapp: null } },
    bookingUrl: 'https://calendly.com/x',
  });
  assert.ok(!html.includes('data-at='));
  assert.ok(!html.includes('wa.me'));
  assert.ok(!html.includes('Download the slides'));
  assert.ok(!html.includes('class="card note"'));
  assert.ok(html.includes('Download the video'));
});

test('a portrait video keeps its shape', () => {
  const html = videoPage({ slug: 'x', links: { ...links, width: 1080, height: 1920 }, bookingUrl: 'https://calendly.com/x' });
  assert.ok(html.includes('--ratio: 1080 / 1920'));
});

test('the holding page says it is nearly ready and looks again', () => {
  const html = videoHoldingPage({ links: { ready: false, status: 'processing', business: 'Evermark & Co' } });
  assert.ok(html.includes('<meta http-equiv="refresh" content="30">'));
  assert.ok(html.includes('A video for Evermark &amp; Co'));
  assert.ok(html.includes('nearly ready'));
  assert.ok(!html.includes('<video'));
});
