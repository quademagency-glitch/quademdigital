import 'dotenv/config'
import payload from 'payload'
import config from '../src/payload.config'

console.log('Initializing payload...')
await payload.init({ config })
console.log('Initialized.')

console.log('Finding blog post future-of-web-dev...')
const posts = await payload.find({
  collection: 'blogPosts',
  where: { slug: { equals: 'future-of-web-dev' } },
  depth: 0,
})

if (posts.docs.length > 0) {
  const doc = posts.docs[0]
  console.log(`Found post ID ${doc.id}. Updating seoDescription...`)
  await payload.update({
    collection: 'blogPosts',
    id: doc.id,
    data: {
      seoDescription: 'Discover the latest trends and frameworks shaping web development — from server components to AI-driven UIs — and what they mean for your site.'
    }
  })
  console.log('Successfully updated the seoDescription for future-of-web-dev.')
} else {
  console.log('Post not found.')
}

process.exit(0)
