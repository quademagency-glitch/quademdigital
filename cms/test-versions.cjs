require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT count(*) FROM _blog_posts_v');
    console.log("VERSIONS count:", res.rows[0]);
    const res2 = await client.query('SELECT parent_id, version__status FROM _blog_posts_v LIMIT 10');
    console.log("VERSIONS sample:", res2.rows);
    await client.end();
  } catch(e) {
    console.error(e);
  }
}
run();
