import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function seedCalc() {
  console.log('Seeding Calculator Services...')
  
  const services = [
    {
      _type: 'calculatorService',
      name: 'Web Design & Development',
      priceUSD: 5000,
      priceGHS: 57500,
      order: 1
    },
    {
      _type: 'calculatorService',
      name: 'Branding & Identity',
      priceUSD: 3500,
      priceGHS: 40000,
      order: 2
    },
    {
      _type: 'calculatorService',
      name: 'SEO & Content',
      priceUSD: 2500,
      priceGHS: 28500,
      billingCycle: ' / mo',
      order: 3
    },
    {
      _type: 'calculatorService',
      name: 'Video Production',
      priceUSD: 4000,
      priceGHS: 46000,
      order: 4
    }
  ]

  for (const service of services) {
    await client.create(service)
    console.log(`Created service: ${service.name}`)
  }
  
  console.log('Done seeding.')
}

seedCalc().catch(err => {
  console.error(err)
  process.exit(1)
})
