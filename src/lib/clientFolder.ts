import { escapeHtml } from './html'

/*
  The client's Google Drive folder in the onboarding emails and checklist
  (Ernest, 9 October 2026: the email asking for what we need "should come
  with an auto-generated google drive link which they can drop all things
  that would go in"). The CMS makes the folder as onboarding starts
  (cms/src/lib/googleDrive.ts) and sends its link with the client. Without
  one, everything reads as before: reply with the files.
*/

/** Only a Google Drive folder link is ever put in an email. */
export function folderLink(url: unknown): string | null {
  const u = String(url ?? '').trim()
  return /^https:\/\/drive\.google\.com\/[\w\-./?=&%]+$/.test(u) ? u : null
}

/** The "how to send us what we need" box in the setup email. */
export function filesBlock(c: { businessName: string; driveFolderUrl?: string | null }): string {
  const url = folderLink(c.driveFolderUrl)
  if (!url) {
    return `
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">How to send us what we need</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        Simply reply to this email with the items listed in the checklist.
        If you have files to share (logos, documents), attach them directly to your reply
        or send a Google Drive or Dropbox link.
      </div>
    </div>`
  }
  return `
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:18px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;font-size:16px;margin-bottom:8px;">Your Quadem folder</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        We have made a Google Drive folder just for ${escapeHtml(c.businessName)}. Drop your logo, photos, videos
        and documents straight into it. There is a space for each, and anything else can go in "Anything else".
      </div>
      <a href="${escapeHtml(url)}" style="display:inline-block;margin-top:14px;background:#0D1B6E;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:bold;">Open your Quadem folder</a>
      <div style="color:#555;font-size:13px;line-height:1.7;margin-top:14px;">
        Google asks you to sign in with any Google account to add files. No Google account? Reply to this email
        with your files attached, or send them to us on WhatsApp.<br>
        Please keep logins and passwords out of the folder: send those by replying to this email.
      </div>
    </div>`
}

/** The sentence at the top of the setup checklist that says how to send things. */
export function checklistIntro(c: { driveFolderUrl?: string | null }): string {
  const url = folderLink(c.driveFolderUrl)
  return url
    ? `To get started as quickly as possible, please gather the items listed below and drop your files into your Quadem folder on Google Drive: ${url} . Send logins and passwords by replying to our email, not in the folder. You can also share files via WhatsApp or email (ernest@quademdigital.com). Tick each box as you complete it.`
    : `To get started as quickly as possible, please gather and send us the items listed below. You can share files via WhatsApp, email (ernest@quademdigital.com), or Google Drive. Tick each box as you complete it.`
}
