import { getPayload } from 'payload';
import configPromise from './src/payload.config';

function lexicalText(text: string, format = 0) {
  return {
    mode: 'normal',
    text,
    type: 'text',
    style: '',
    detail: 0,
    format,
    version: 1
  };
}

function lexicalParagraph(children: any[]) {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    children
  };
}

function lexicalHeading(tag: string, text: string) {
  return {
    type: 'heading',
    tag,
    format: '',
    indent: 0,
    version: 1,
    children: [lexicalText(text)]
  };
}

function lexicalRoot(children: any[]) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children
    }
  };
}

const customContent: Record<string, any> = {
  'Omek Storefront': [
    lexicalHeading('h2', 'The Challenge'),
    lexicalParagraph([lexicalText("Omek needed a high-performance e-commerce storefront to handle their rapidly growing inventory and traffic while delivering a seamless, modern shopping experience for their customers. Their previous platform was slow and hindered scaling.")]),
    lexicalHeading('h2', 'The Solution'),
    lexicalParagraph([lexicalText("We built a fully custom, lightning-fast digital storefront with optimized conversion funnels, intuitive product discovery, and a highly robust backend infrastructure to support peak sales periods without breaking a sweat.")]),
    lexicalHeading('h2', 'The Results'),
    lexicalParagraph([lexicalText("The new storefront delivered a premium brand feel, resulting in a massive boost in sales, significantly lower bounce rates, and a frictionless checkout process that keeps customers coming back for more.")])
  ],
  'QuadERP Landing': [
    lexicalHeading('h2', 'The Challenge'),
    lexicalParagraph([lexicalText("QuadERP, a comprehensive enterprise resource planning tool, struggled to communicate its complex features simply and effectively to potential enterprise clients. They needed a digital presence that converted visitors into qualified leads.")]),
    lexicalHeading('h2', 'The Solution'),
    lexicalParagraph([lexicalText("We designed and developed a high-converting landing page focused on crystal-clear value propositions, engaging product mockups, and strategically placed calls-to-action. We streamlined the messaging to speak directly to enterprise decision-makers.")]),
    lexicalHeading('h2', 'The Results'),
    lexicalParagraph([lexicalText("The new landing page significantly increased software demo requests and reduced customer acquisition costs, firmly establishing QuadERP as a premier, trustworthy choice in the competitive enterprise software market.")])
  ],
  'SAN Collection': [
    lexicalHeading('h2', 'The Challenge'),
    lexicalParagraph([lexicalText("SAN Collection, an emerging luxury fashion brand, required an elegant online presence that perfectly matched the exclusivity, craftsmanship, and premium quality of their physical garments.")]),
    lexicalHeading('h2', 'The Solution'),
    lexicalParagraph([lexicalText("We crafted a visually stunning, image-rich e-commerce experience. By implementing smooth animations, minimalist design principles, and a frictionless checkout process, we created an online boutique tailored specifically for high-end clientele.")]),
    lexicalHeading('h2', 'The Results'),
    lexicalParagraph([lexicalText("The launch resulted in an immediately elevated brand perception, a substantial increase in direct-to-consumer online sales, and a higher average order value across their entire catalog.")])
  ],
  'Quajo Speaks': [
    lexicalHeading('h2', 'The Challenge'),
    lexicalParagraph([lexicalText("Renowned speaker and thought leader Quajo needed a centralized, authoritative digital hub to showcase his keynotes, media appearances, and provide a seamless process for event organizers to book him.")]),
    lexicalHeading('h2', 'The Solution'),
    lexicalParagraph([lexicalText("We delivered a sleek, highly personal portfolio site featuring dynamic video integration, powerful storytelling elements, and a streamlined, automated booking system that removes friction for event coordinators.")]),
    lexicalHeading('h2', 'The Results'),
    lexicalParagraph([lexicalText("The new platform significantly enhanced Quajo's digital authority, leading to a fully booked speaking calendar, higher engagement from his audience, and elevated positioning in the speaking circuit.")])
  ],
  'QuadBrand': [
    lexicalHeading('h2', 'The Challenge'),
    lexicalParagraph([lexicalText("As a forward-thinking creative branding agency, QuadBrand needed their own digital identity to reflect their immense creative prowess, stand out in a saturated market, and attract high-ticket clients.")]),
    lexicalHeading('h2', 'The Solution'),
    lexicalParagraph([lexicalText("We conceptualized and deployed a cutting-edge, highly interactive agency website. We focused on dynamic case study showcases, immersive micro-interactions, and bold typography to let the work speak for itself.")]),
    lexicalHeading('h2', 'The Results'),
    lexicalParagraph([lexicalText("The result is a memorable, award-worthy digital experience that serves as a powerful lead-generation engine and perfectly embodies the agency's creative and technical capabilities.")])
  ]
};

async function run() {
  console.log(`Using NODE_ENV: ${process.env.NODE_ENV}`);
  const payload = await getPayload({ config: configPromise });

  const docs = await payload.find({
    collection: 'caseStudies',
    limit: 100,
  });

  for (const doc of docs.docs) {
    const title = doc.title;
    
    if (customContent[title]) {
      console.log(`Updating rich text for: ${title}`);
      
      const newBody = lexicalRoot(customContent[title]);

      try {
        await payload.update({
          collection: 'caseStudies',
          id: doc.id,
          data: {
            body: newBody
          }
        });
        console.log(`✅ Updated ${title}`);
      } catch (err: any) {
        console.error(`❌ Failed to update ${title}: ${err.message}`);
      }
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
