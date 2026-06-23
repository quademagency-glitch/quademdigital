const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
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
