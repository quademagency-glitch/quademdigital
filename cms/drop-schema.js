const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:***REMOVED-DB-PASSWORD***@thomas.proxy.rlwy.net:12189/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Dropping public schema to reset Payload (this deletes all Payload tables)...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    
    console.log('✅ Successfully wiped database schema! Payload can now recreate it.');
    await client.end();
  } catch (error) {
    console.error('❌ Failed to drop schema:', error.message);
    process.exit(1);
  }
}

run();
