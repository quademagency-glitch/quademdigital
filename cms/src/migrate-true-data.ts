import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { getPayload } from 'payload'
import configPromise from './payload.config'
import mime from 'mime-types'

dotenvConfig({ path: '.env' })

async function run() {
  const payload = await getPayload({ config: configPromise })
  
  const ndjsonPath = path.resolve(process.cwd(), '../studio/production-export-2026-06-15t14-46-06-449z/data.ndjson')
  const imagesDir = path.resolve(process.cwd(), '../studio/production-export-2026-06-15t14-46-06-449z/images')

  console.log(`Loading Sanity export data from ${ndjsonPath}`)
  const documents: any[] = []
  
  const fileStream = fs.createReadStream(ndjsonPath)
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (line.trim()) {
      documents.push(JSON.parse(line))
    }
  }

  console.log(`Loaded ${documents.length} documents. Wiping existing data...`)

  const collectionsToWipe = [
    'blogPosts', 'blogCategories', 'caseStudies', 'offers', 'calculatorServices',
    'webapps', 'services', 'pricingPlans', 'processSteps', 'stats', 'testimonials',
    'clients', 'invoices', 'onboardingGuides', 'emailCampaigns', 'leads'
  ]

  for (const slug of collectionsToWipe) {
    try {
      await payload.delete({ collection: slug as any, where: { id: { exists: true } } })
      console.log(`Wiped ${slug}`)
    } catch (e) {
      console.log(`Could not wipe ${slug} (maybe empty)`)
    }
  }

  const idMap: Record<string, number> = {}
  const mediaMap: Record<string, number> = {}

  // Function to recursively find and upload images
  async function processImages(obj: any): Promise<any> {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(processImages))
    } else if (obj !== null && typeof obj === 'object') {
      if (obj._type === 'image' && obj._sanityAsset) {
        const filename = obj._sanityAsset.split('file://./images/')[1]
        if (filename) {
          if (!mediaMap[filename]) {
            const filePath = path.join(imagesDir, filename)
            if (fs.existsSync(filePath)) {
              console.log(`Uploading media: ${filename}`)
              const fileBuffer = fs.readFileSync(filePath)
              const mimetype = mime.lookup(filePath) || 'application/octet-stream'
              const size = fs.statSync(filePath).size
              const media = await payload.create({
                collection: 'media',
                data: { alt: filename },
                file: { data: fileBuffer, name: filename, mimetype, size }
              })
              mediaMap[filename] = media.id as number
            } else {
              console.warn(`Missing file: ${filePath}`)
            }
          }
          return mediaMap[filename]
        }
      }

      // Convert references
      if (obj._type === 'reference' && obj._ref) {
        if (idMap[obj._ref]) {
          return idMap[obj._ref]
        } else {
          // If we haven't mapped it yet, we just return the original obj and hope we can fix it later, or it's a cyclic ref
          return obj
        }
      }

      const newObj: any = {}
      for (const [k, v] of Object.entries(obj)) {
        if (k === '_sanityAsset' || k === '_type' && obj._type === 'image') continue; // Clean up payload
        newObj[k] = await processImages(v)
      }
      return newObj
    }
    return obj
  }

  // Phase 1: Upload all media and Parent-less items
  console.log('\\n--- Phase 1: Parent-less Collections ---')
  const phase1Types = ['blogCategory', 'calculatorService', 'clientPortal', 'offer', 'pricingPlan', 'processStep', 'stat', 'testimonial', 'formSubmission', 'onboardingGuide', 'emailCampaign']
  
  for (const doc of documents) {
    if (phase1Types.includes(doc._type)) {
      const processed = await processImages(doc)
      const mappedCollection = getPayloadSlug(doc._type)
      
      try {
        const created = await payload.create({ collection: mappedCollection as any, data: mapFields(doc._type, processed) })
        idMap[doc._id] = created.id as number
        console.log(`Created ${doc._type}: ${created.id}`)
      } catch (err: any) {
        console.error(`Error creating ${doc._type}: ${err.message}`)
      }
    }
  }

  // Phase 2: Items with relationships
  console.log('\\n--- Phase 2: Collections with Relationships ---')
  const phase2Types = ['blogPost', 'caseStudy', 'service', 'webapp', 'invoice']
  for (const doc of documents) {
    if (phase2Types.includes(doc._type)) {
      const processed = await processImages(doc)
      const mappedCollection = getPayloadSlug(doc._type)
      
      try {
        const created = await payload.create({ collection: mappedCollection as any, data: mapFields(doc._type, processed) })
        idMap[doc._id] = created.id as number
        console.log(`Created ${doc._type}: ${created.id}`)
      } catch (err: any) {
        console.error(`Error creating ${doc._type}: ${err.message}`)
      }
    }
  }

  // Phase 3: Globals
  console.log('\\n--- Phase 3: Globals ---')
  const globalTypes = ['about', 'contactPage', 'homepage', 'projectsPage', 'quaderp', 'servicesPage', 'siteSettings']
  for (const doc of documents) {
    if (globalTypes.includes(doc._type)) {
      const processed = await processImages(doc)
      const mappedSlug = doc._type === 'quaderp' ? 'quaderpPage' : doc._type
      try {
        await payload.updateGlobal({ slug: mappedSlug as any, data: mapFields(doc._type, processed) })
        console.log(`Updated Global: ${mappedSlug}`)
      } catch (err: any) {
        console.error(`Error updating Global ${mappedSlug}: ${err.message}`)
      }
    }
  }

  console.log('\\n🎉 True Sanity Migration Complete!')
  process.exit(0)
}

function getPayloadSlug(sanityType: string): string {
  const map: any = {
    'blogCategory': 'blogCategories',
    'blogPost': 'blogPosts',
    'calculatorService': 'calculatorServices',
    'caseStudy': 'caseStudies',
    'clientPortal': 'clients',
    'offer': 'offers',
    'pricingPlan': 'pricingPlans',
    'processStep': 'processSteps',
    'service': 'services',
    'stat': 'stats',
    'testimonial': 'testimonials',
    'webapp': 'webapps',
    'formSubmission': 'leads',
    'invoice': 'invoices',
    'onboardingGuide': 'onboarding-guides',
    'emailCampaign': 'emailCampaigns',
  }
  return map[sanityType] || sanityType
}

function ptToLexical(blocks: any) {
  if (!Array.isArray(blocks)) return null

  const rootChildren: any[] = []
  let currentList: any = null

  for (const block of blocks) {
    if (typeof block === 'number') {
      rootChildren.push({
        type: 'upload',
        relationTo: 'media',
        value: block,
        format: '',
        version: 1
      })
      continue
    }
    
    if (block._type === 'block') {
      const children = (block.children || []).map((child: any) => {
        let format = 0
        if (child.marks?.includes('strong')) format |= 1
        if (child.marks?.includes('em')) format |= 2
        if (child.marks?.includes('strike-through')) format |= 4
        if (child.marks?.includes('underline')) format |= 8
        if (child.marks?.includes('code')) format |= 16
        return {
          type: 'text',
          text: child.text || '',
          format,
          style: '',
          mode: 'normal',
          detail: 0,
          version: 1,
        }
      })

      if (block.listItem) {
        if (
          !currentList ||
          currentList.listType !== block.listItem ||
          currentList.indent !== (block.level ? block.level - 1 : 0)
        ) {
          currentList = {
            type: 'list',
            listType: block.listItem === 'number' ? 'number' : 'bullet',
            format: '',
            indent: block.level ? block.level - 1 : 0,
            version: 1,
            children: [],
          }
          rootChildren.push(currentList)
        }
        currentList.children.push({
          type: 'listitem',
          format: '',
          indent: 0,
          version: 1,
          value: currentList.children.length + 1,
          children,
        })
        continue
      }

      currentList = null // reset list

      let type = 'paragraph'
      let tag = null
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.style)) {
        type = 'heading'
        tag = block.style
      } else if (block.style === 'blockquote') {
        type = 'quote'
      }

      const node: any = {
        type,
        format: '',
        indent: 0,
        version: 1,
        children,
      }
      if (tag) node.tag = tag

      rootChildren.push(node)
        } else if (block._type === 'image') {
      currentList = null
      
      let mediaId = 1
      if (block._sanityAsset) {
        const filename = block._sanityAsset.split('file://./images/')[1]
        if (filename && mediaMap[filename]) {
          mediaId = mediaMap[filename]
        }
      } else if (typeof block === 'number') {
        mediaId = block
      }
      
      rootChildren.push({
        type: 'upload',
        relationTo: 'media',
        value: mediaId,
        format: '',
        version: 1
      })
    }
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: rootChildren,
    },
  }
}

function mapFields(type: string, doc: any): any {
  // Map common fields
  const data: any = { ...doc }
  
  if (data.body) {
    data.body = ptToLexical(data.body)
  }
  if (data.content && type === 'onboardingGuide') {
    data.content = ptToLexical(data.content)
  }
  
  if (data.slug?.current) data.slug = data.slug.current
  if (data.coverImage) data.image = data.coverImage // Map coverImage to image for Payload
  if (data.coverImage && type === 'caseStudy') data.coverImage = data.coverImage // Case study uses coverImage

  // Type specific mapping
  if (type === 'calculatorService') {
    data.basePrice = Number(doc.basePrice) || 0
  }

  if (type === 'pricingPlan') {
    data.price = doc.price || 'Custom'
    if (Array.isArray(doc.features)) {
      data.features = doc.features.map((f: any) => typeof f === 'string' ? { feature: f } : f)
    }
  }

  if (type === 'service' && Array.isArray(doc.tags)) {
    data.tags = doc.tags.map((t: any) => typeof t === 'string' ? { tag: t } : t)
  }

  if (type === 'homepage' && Array.isArray(doc.heroServices)) {
    data.heroServices = doc.heroServices.map((s: any) => typeof s === 'string' ? { service: s } : s)
  }

  if (type === 'siteSettings' && Array.isArray(doc.clientLogos)) {
    data.clientLogos = doc.clientLogos.map((logo: any) => typeof logo === 'number' ? { logo } : logo)
  }

  if (type === 'blogCategory' && !data.slug && data.title) {
    data.slug = data.title.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  if (type === 'invoice') {
    data.status = doc.status ? doc.status.toLowerCase() : 'pending'
    data.client = doc.client?._ref || doc.client
  }

  if (type === 'clientPortal') {
    data.clientName = doc.clientName || 'Unknown'
    data.accessCode = doc.accessCode || Math.random().toString(36).substring(2, 8)
    if (data.onboardingGuide?._ref) data.onboardingGuide = data.onboardingGuide._ref // Fix ref
    if (Array.isArray(doc.deliverables)) {
      data.deliverables = doc.deliverables.map((d: any) => ({
        title: d.title || 'Untitled',
        url: d.url || '#',
        category: d.category || 'other'
      }))
    }
  }
  
  if (type === 'blogPost') {
    data.category = doc.category?._ref || doc.category // Ensure ref is passed
  }

  return data
}

run().catch(console.error)
