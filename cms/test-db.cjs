require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Connecting to database...');
client.connect()
  .then(() => {
    console.log('Successfully connected to Postgres!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Query result:', res.rows[0]);
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
