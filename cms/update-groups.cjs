const fs = require('fs');
const path = require('path');

const groups = {
  'Content': ['BlogPosts.ts', 'BlogCategories.ts', 'Faqs.ts', 'Tags.ts'],
  'Portfolio': ['CaseStudies.ts', 'Webapps.ts'],
  'Services': ['Services.ts', 'CalculatorServices.ts', 'PricingPlans.ts', 'Offers.ts', 'ProcessSteps.ts', 'Stats.ts'],
  'CRM': ['Leads.ts', 'Clients.ts', 'Invoices.ts', 'Testimonials.ts', 'OnboardingGuides.ts'],
  'Settings & Media': ['Users.ts', 'Media.ts', 'Folders.ts']
};

const collectionsDir = path.join(__dirname, 'src', 'collections');

for (const [groupName, files] of Object.entries(groups)) {
  for (const file of files) {
    const filePath = path.join(collectionsDir, file);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it already has an admin object
    if (content.includes('admin: {') || content.includes('admin:{')) {
      // Just inject group property into existing admin object
      content = content.replace(/admin:\s*\{/, `admin: {\n    group: '${groupName}',`);
    } else {
      // Inject admin object right after slug
      content = content.replace(/slug:\s*['"]\w+['"],/, `$&
  admin: {
    group: '${groupName}',
  },`);
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file} with group ${groupName}`);
  }
}
