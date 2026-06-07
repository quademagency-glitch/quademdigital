import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function migrateSocialLinks() {
  console.log('Fetching siteSettings...')
  const doc = await client.getDocument('siteSettings')
  
  if (!doc) {
    console.log('siteSettings document not found.')
    return
  }

  if (doc.socialLinks && !Array.isArray(doc.socialLinks)) {
    console.log('Migrating socialLinks from object to array...')
    const newSocialLinks = []
    
    // The old object looks like { linkedin: "...", instagram: "...", twitter: "..." }
    for (const [key, value] of Object.entries(doc.socialLinks)) {
      if (value && typeof value === 'string' && !key.startsWith('_')) {
         newSocialLinks.push({
           _key: Math.random().toString(36).substring(2, 9),
           platform: key,
           url: value
         })
      }
    }
    
    await client.patch('siteSettings').set({ socialLinks: newSocialLinks }).commit()
    console.log('Migration complete! Refresh your Sanity Studio.')
  } else {
    console.log('socialLinks is already an array or does not exist. No migration needed.')
  }
}

migrateSocialLinks().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
