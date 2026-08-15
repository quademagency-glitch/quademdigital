require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM _blog_posts_v');
    console.log("VERSIONS:", res.rows);
    await client.end();
  } catch(e) {
    console.error(e);
  }
}
run();
