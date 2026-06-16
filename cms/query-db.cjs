const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:***REMOVED-DB-PASSWORD***@thomas.proxy.rlwy.net:12189/railway?uselibpqcompat=true&sslmode=disable'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, email FROM users');
    console.log("USERS:", res.rows);
    await client.end();
  } catch(e) {
    console.error(e);
  }
}
run();
