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
