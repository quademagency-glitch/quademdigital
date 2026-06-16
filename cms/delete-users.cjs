const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:***REMOVED-DB-PASSWORD***@thomas.proxy.rlwy.net:12189/railway?uselibpqcompat=true&sslmode=disable'
});

async function run() {
  try {
    await client.connect();
    await client.query('DELETE FROM users');
    console.log("DELETED ALL USERS SUCCESSFULLY");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
