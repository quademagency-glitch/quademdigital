// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

/*
  Never real storage from a test. cms/.env names the live buckets, so without
  this every file a test uploads (sample agreements, signing PDFs, pitch files)
  lands in production storage while its record sits in the local test
  database: 93 sample PDFs reached the live documents bucket on 6 October 2026
  that way. With the buckets unset, uploads go to local folders git ignores.
*/
process.env.S3_BUCKET = ''
process.env.S3_DOCUMENTS_BUCKET = ''

/*
  Nor the live website, AI or database (CMS review, 8 October 2026). cms/.env
  also holds the secret the live website accepts, so a test that forgot to
  stand in for fetch could have filed documents or sent emails through it; a
  wrong secret makes the website refuse. The AI keys would have spent real
  calls, and the database address is only ever wanted in production.
*/
process.env.CMS_WEBHOOK_SECRET = 'test-secret-the-live-website-refuses'
// Where links point. A local cms/.env gives it; GitHub has none.
process.env.ASTRO_SITE_URL ||= 'https://quademdigital.com'
process.env.GEMINI_API_KEY = ''
process.env.GEMINI_IMAGE_API_KEY = ''
process.env.BLOOM_API_KEY = ''
process.env.DATABASE_URL = ''
