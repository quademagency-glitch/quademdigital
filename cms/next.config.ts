import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
  serverExternalPackages: ['pdf-parse', 'mammoth', '@google/generative-ai'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
      {
        /*
          Media files were served with no Cache-Control at all, which is the
          worst of both worlds: browsers fall back to heuristic freshness, and
          any CDN placed in front refuses to hold them. Every image on every
          page was refetched from this single small instance on every visit,
          which no amount of better compression can make up for.

          `immutable` is safe here only because the site appends ?v= to every
          media URL from the doc's updatedAt (see buildPayloadImageUrl in the
          site repo's src/lib/payload.ts). Payload keeps a filename when
          artwork behind it is replaced, so without that parameter a swapped
          image would never reach anyone who had already seen the old one.
        */
        source: '/api/media/file/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public Payload globals are `read: () => true` and hold only page
        // content, so anonymous reads are safe to cache at any CDN placed in
        // front of the CMS (absorbs read bursts). The `missing` conditions skip
        // authenticated admin requests (no-auth only), so editors always see
        // fresh data immediately after saving. Inert until a CDN fronts the CMS.
        source: '/api/globals/:slug*',
        missing: [
          { type: 'header', key: 'authorization' },
          { type: 'cookie', key: 'payload-token' },
        ],
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
