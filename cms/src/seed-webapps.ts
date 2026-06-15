import { config as dotenvConfig } from 'dotenv'
import path from 'path'
dotenvConfig({ path: '.env' })

import { getPayload } from 'payload'
import configPromise from './payload.config'

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('Migrating Webapps (Portfolio)...')
  const webapps = [
    {
      name: 'Quaderp ERP',
      tagline: 'Enterprise Resource Planning System',
      description: 'A comprehensive ERP system for managing business operations, inventory, and point of sale.',
      status: 'Active',
      order: 1
    },
    {
      name: 'Sancollection',
      tagline: 'Premium E-Commerce Experience',
      description: 'A beautifully designed, high-converting e-commerce storefront.',
      status: 'Active',
      order: 2
    },
    {
      name: 'Quabrand',
      tagline: 'Brand Management Portal',
      description: 'Centralized platform for managing brand assets and identity guidelines.',
      status: 'Active',
      order: 3
    }
  ]

  for (const w of webapps) {
    try {
      await payload.create({ collection: 'webapps', data: w })
      console.log(`✅ Created webapp: ${w.name}`)
    } catch (err) {
      console.log(`⏭ Skipping webapp ${w.name} - already exists or error.`)
    }
  }

  console.log('\\n🎉 Webapps Migration Complete!')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
