import { getPayload } from 'payload'
import configPromise from '../../../payload.config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
      collection: 'blogPosts',
      draft: true,
      limit: 1,
    })
    return NextResponse.json({ success: true, res })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack })
  }
}
