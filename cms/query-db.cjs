require('dotenv').config();
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, title, "publishedAt" FROM blog_posts');
    console.log("BLOG POSTS:", res.rows);
    await client.end();
  } catch(e) {
    console.error(e);
  }
}
run();
