import { Pool } from 'pg'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'No DATABASE_URL found' })
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Railway sometimes requires this
  })

  try {
    const client = await pool.connect()
    
    // First, let's just test if we can run a simple query
    const res = await client.query('SELECT current_database();')
    
    // Then let's check for locked documents relations table
    let lockedTableExists = false;
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'payload_locked_documents_rels'
        );
      `)
      lockedTableExists = tableCheck.rows[0].exists
    } catch (e) {}

    // Let's drop it if it exists to fix the migration error
    let dropResult = 'Not attempted';
    if (lockedTableExists) {
      try {
        await client.query('DROP TABLE IF EXISTS payload_locked_documents_rels CASCADE;')
        await client.query('DROP TABLE IF EXISTS payload_locked_documents CASCADE;')
        await client.query('DROP TABLE IF EXISTS payload_preferences_rels CASCADE;')
        await client.query('DROP TABLE IF EXISTS payload_preferences CASCADE;')
        dropResult = 'Successfully dropped locked and preference tables';
      } catch (e: any) {
        dropResult = `Failed to drop: ${e.message}`;
      }
    }

    client.release()
    return NextResponse.json({ 
      success: true, 
      database: res.rows[0], 
      lockedTableExists,
      dropResult
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message, 
      stack: error.stack 
    })
  }
}
