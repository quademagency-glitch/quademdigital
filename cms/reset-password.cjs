const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Password123!', salt);
    await client.connect();
    
    // First, let's see what columns exist on users just to be safe
    const res = await client.query('UPDATE users SET hash = $1, salt = $2 WHERE email = $3 RETURNING id', [hash, salt, 'ernest@quademdigital.com']);
    console.log("PASSWORD RESET SUCCESS", res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
