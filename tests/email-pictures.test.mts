// Run with: npx tsx --test tests/email-pictures.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { lexicalToEmailHtml, lexicalToHtml } from '../src/lib/payload.ts';

const picture = {
  id: 7,
  url: 'https://media.quademdigital.com/media/menu.jpg',
  alt: 'The festive menu',
  width: 2400,
  height: 1600,
  caption: 'Our <best> dishes',
  sizes: {
    medium: { url: 'https://media.quademdigital.com/media/menu-800x533.jpg', width: 800, height: 533 },
    mediumAvif: { url: 'https://media.quademdigital.com/media/menu-800x533.avif', width: 800 },
  },
};
const body = {
  root: {
    children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: 1 }] },
      { type: 'upload', relationTo: 'media', value: picture },
      { type: 'upload', relationTo: 'media', value: 7 },
    ],
  },
};

test('a newsletter picture goes out as a plain, absolute image no wider than the email', () => {
  const html = lexicalToEmailHtml(body);
  assert.match(html, /<p><strong>Hello<\/strong><\/p>/);
  assert.match(html, /<img src="https:\/\/media\.quademdigital\.com\/media\/menu-800x533\.jpg[^"]*" alt="The festive menu" width="600"/);
  assert.doesNotMatch(html, /<picture|srcset|avif/i, 'mail clients ignore these');
  assert.match(html, /Our &lt;best&gt; dishes/, 'the caption is text, escaped');
});

test('a picture whose record was not filled in is left out rather than broken', () => {
  assert.equal((lexicalToEmailHtml(body).match(/<img/g) ?? []).length, 1);
});

test('web pages keep their own picture markup', () => {
  assert.match(lexicalToHtml(body), /<picture>/);
});
