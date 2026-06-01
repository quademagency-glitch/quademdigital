import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function seedAbout() {
  console.log('Seeding About Me data...')
  
  await client.createOrReplace({
    _id: 'about',
    _type: 'about',
    title: 'About Me',
    headline: "Hey, I'm the face behind Quadem Digital.",
    bio: "I started this agency with one simple belief: great design and smart strategy shouldn't just look good—they should make you money.\n\nUnlike huge, bloated agencies where you're just another account number, Quadem operates as your personal digital growth partner. When you work with us, you get direct communication, rapid execution, and a team that genuinely cares about your bottom line.\n\nWhether you need a high-converting website, a fresh brand identity, or a marketing campaign that actually works, we've got you covered.",
    mission: "Our mission is to empower brands with digital solutions that drive real, measurable growth. We strive to create experiences that not only look stunning but deliver tangible results.",
    vision: "We envision a digital landscape where every business, regardless of size, can compete at the highest level through premium design and strategic digital marketing.",
    coreValues: [
      {
        _key: 'val1',
        title: "Results Driven",
        description: "We focus on metrics that matter. Every design and campaign is optimized for ROI and real business impact."
      },
      {
        _key: 'val2',
        title: "Transparency",
        description: "No hidden fees, no jargon, just clear communication. We keep you in the loop at every stage of the process."
      },
      {
        _key: 'val3',
        title: "Premium Quality",
        description: "We don't settle for 'good enough'. Our work reflects a standard of excellence that elevates your brand above the competition."
      }
    ]
  })
  
  console.log('Created About Me document.')
}

seedAbout().catch(err => {
  console.error(err)
  process.exit(1)
})
