import type { Payload } from 'payload'

export async function generateEmailDraft(doc: any, payload: Payload) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      payload.logger.warn('No GEMINI_API_KEY found, skipping AI email generation.')
      return
    }

    // Dynamically import heavy server-side libraries to prevent them from crashing the Next.js config parser
    const { PDFParse } = await import('pdf-parse')
    const mammoth = await import('mammoth')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // 1. Fetch the file content
    // Determine the full URL. If doc.url is relative, prepend the server URL.
    const fileUrl = doc.url.startsWith('http') 
      ? doc.url 
      : `${payload.config.serverURL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}${doc.url}`
    
    payload.logger.info(`Fetching document for AI parsing from: ${fileUrl}`)
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ''

    // 2. Parse text from the file
    if (doc.mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer })
      const pdfData = await parser.getText()
      extractedText = pdfData.text
    } else if (doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const docxData = await mammoth.extractRawText({ buffer })
      extractedText = docxData.value
    } else {
      payload.logger.warn(`Unsupported file type for AI parsing: ${doc.mimeType}`)
      return
    }

    // 3. Prompt Gemini AI
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    
    const prompt = `
You are an expert copywriter and onboarding specialist for Quadem Digital Enterprise.
I will provide you with the raw text extracted from a client's onboarding document (which might be an SLA, Setup Instructions, Onboarding Guide, or a combination).

Your goal is to draft a professional, warmly welcoming, and well-structured email to the client summarizing the key points and guiding them on their next steps. 

Requirements:
- Never use an em dash anywhere in the subject, preview text or body. They
  read as machine-written. Use a colon for labels, or a comma or full stop in
  prose. En dashes (–) are also out. Plain hyphens in compound words are fine.
- Write in the first person singular, as Ernest. This is a founder-led studio:
  the client is talking to a person, not "the team".
- The output MUST be a valid JSON object with the following exact keys:
  - "subject": A catchy and professional subject line for the email.
  - "previewText": A short preview text (preheader) for the email.
  - "body_html": The well-designed HTML body of the email. Use professional inline styling (brand colors: dark sleek tones or clean white, legible fonts). It should look like a premium agency email. Do NOT include html/head/body tags, just the content (divs, headings, paragraphs) that would go inside an email body.

Here is the extracted text:
---
${extractedText.substring(0, 30000)} // Limiting to prevent token explosion
---
`
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    
    // Parse the JSON response. Gemini sometimes wraps it in markdown code blocks.
    let parsedResult;
    try {
      const jsonString = responseText.replace(/^```json\n/g, '').replace(/^```\n/g, '').replace(/\n```$/g, '').trim()
      parsedResult = JSON.parse(jsonString)
    } catch (e) {
      payload.logger.error({ responseText }, 'Failed to parse JSON from Gemini')
      throw new Error('Invalid JSON from AI model')
    }

    // 4. Create Draft Email Campaign
    //
    // The prompt asks for no em dashes, but a model will still emit them, and
    // this copy goes to a client over Ernest's name. Strip them here so the
    // rule holds regardless of what came back. Spaced dashes become a comma,
    // which reads correctly in the clause-joining case the model uses them for;
    // an unspaced one becomes a plain hyphen.
    const deDash = (s: string) =>
      String(s).replace(/\s+[\u2014\u2013]\s+/g, ', ').replace(/[\u2014\u2013]/g, '-')

    await payload.create({
      collection: 'emailCampaigns',
      data: {
        client: doc.client, // Assuming single relation id or object
        subject: deDash(parsedResult.subject || 'Your Onboarding Materials'),
        previewText: deDash(parsedResult.previewText || 'Welcome to Quadem Digital'),
        body_html: deDash(parsedResult.body_html || '<p>Please review the attached onboarding documents.</p>'),
        status: 'draft',
      }
    })

    // 5. Update the Document to mark as generated
    await payload.update({
      collection: 'onboarding-documents',
      id: doc.id,
      data: {
        emailDraftGenerated: true
      }
    })

    payload.logger.info(`Successfully generated AI email draft for document ${doc.id}`)

  } catch (error: any) {
    payload.logger.error(error, 'Error generating AI email draft')
  }
}
