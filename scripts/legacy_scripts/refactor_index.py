import re

with open("src/pages/index.astro", "r") as f:
    content = f.read()

parts = content.split("---", 2)
frontmatter = parts[1]
body = parts[2]

new_imports = """
import HeroSection from '../components/home/HeroSection.astro';
import SocialProof from '../components/home/SocialProof.astro';
import ServicesSection from '../components/home/ServicesSection.astro';
import ProcessSection from '../components/home/ProcessSection.astro';
import FeaturedWork from '../components/home/FeaturedWork.astro';
import PricingSection from '../components/home/PricingSection.astro';
import TestimonialsSection from '../components/home/TestimonialsSection.astro';
import FAQSection from '../components/home/FAQSection.astro';
"""

frontmatter = frontmatter.replace('import { sanityClient } from "sanity:client";', 'import { sanityClient } from "sanity:client";\n' + new_imports)

# Extract from BaseLayout to end
layout_start = body.find("<BaseLayout")
layout_str = body[layout_start:]

# We'll replace the massive sections with component tags
# First, find the "Products" section and "About" section and "Newsletter" and "Contact" since they weren't extracted
# Actually, let's just use regex to remove the sections we extracted and insert the components.

hero_regex = re.compile(r'<!-- Section 2 — Hero -->.*?</section>', re.DOTALL)
stats_regex = re.compile(r'<!-- Section 3 — Social Proof Strip -->.*?</section>\s*<!-- Trust Bar / Client Marquee -->.*?</section>', re.DOTALL)
services_regex = re.compile(r'<!-- Section 4 — Services -->.*?</section>', re.DOTALL)
work_regex = re.compile(r'<!-- Section 5 — Case Studies -->.*?</section>', re.DOTALL)
process_regex = re.compile(r'<!-- Section 6 — How We Work \(Process\) -->.*?</section>', re.DOTALL)
pricing_regex = re.compile(r'<!-- Project Cost Calculator -->.*?</section>\s*<!-- Section 7 — Pricing / Packages -->.*?</section>', re.DOTALL)
testimonials_regex = re.compile(r'<!-- Section 8 — Testimonials -->.*?</section>', re.DOTALL)
faq_regex = re.compile(r'<!-- Section 10\.5 — FAQ -->.*?</section>', re.DOTALL)

body = hero_regex.sub('<HeroSection heroHeadline={heroHeadline} heroTagline={heroTagline} heroServices={heroServices} />', body)
body = stats_regex.sub('<SocialProof stats={stats} siteSettings={siteSettings} />', body)
body = services_regex.sub('<ServicesSection fetchedServices={fetchedServices} />', body)
body = work_regex.sub('<FeaturedWork fetchedCaseStudies={fetchedCaseStudies} />', body)
body = process_regex.sub('<ProcessSection processSteps={processSteps} />', body)
body = pricing_regex.sub('<PricingSection pricingPlans={pricingPlans} calculatorServices={calculatorServices} whatsappNumber={whatsappNumber} />', body)
body = testimonials_regex.sub('<TestimonialsSection testimonials={testimonials} />', body)
body = faq_regex.sub('<FAQSection faqs={faqs} />', body)

new_content = "---" + frontmatter + "---" + body

with open("src/pages/index.astro", "w") as f:
    f.write(new_content)

print("Refactored index.astro")
