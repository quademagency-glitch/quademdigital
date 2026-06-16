import { getPayload } from 'payload'
import configPromise from './src/payload.config'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

async function run() {
  const payload = await getPayload({ config: configPromise })
  const users = await payload.find({ collection: 'users' })
  console.log('Existing users:')
  users.docs.forEach(u => console.log(u.email))
  
  if (users.docs.length === 0) {
    console.log('No users found. Creating default admin...')
    await payload.create({
      collection: 'users',
      data: {
        email: 'admin@quademdigital.com',
        password: 'Password123!',
      },
      draft: false,
    })
    console.log('Created admin@quademdigital.com / Password123!')
  }
  process.exit(0)
}

run().catch(console.error)
