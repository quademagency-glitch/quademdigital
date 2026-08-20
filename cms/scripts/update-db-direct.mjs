import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:./payload-dev.db',
});

async function run() {
  try {
    const res = await client.execute("UPDATE `blog_posts` SET `seo_description` = 'Discover the latest trends and frameworks shaping web development, from server components to AI-driven UIs, and what they mean for your site.' WHERE `slug` = 'future-of-web-dev'");
    console.log("Update result:", res);
  } catch (e) {
    console.error(e);
  }
}

run();
