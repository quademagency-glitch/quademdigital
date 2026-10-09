import assert from 'node:assert/strict'
import { checklistIntro, filesBlock, folderLink } from '../src/lib/clientFolder.ts'

// The client's Google Drive folder in the setup email and checklist (src/lib/clientFolder.ts).
const url = 'https://drive.google.com/drive/folders/1AbC-dEf_123?usp=sharing'

assert.equal(folderLink(url), url)
assert.equal(folderLink('https://evil.example/drive.google.com'), null, 'only a Google Drive link is put in an email')
assert.equal(folderLink('javascript:alert(1)'), null)
assert.equal(folderLink(undefined), null)

const withFolder = filesBlock({ businessName: 'Mama <Ade>', driveFolderUrl: url })
assert.ok(withFolder.includes(`href="${url.replace(/&/g, '&amp;')}"`), 'the button opens the folder')
assert.ok(withFolder.includes('Open your Quadem folder'))
assert.ok(withFolder.includes('Mama &lt;Ade&gt;'), 'the business name is escaped')
assert.ok(withFolder.includes('No Google account? Reply to this email'), 'a client without Google can still reply')
assert.ok(withFolder.includes('keep logins and passwords out of the folder'))
assert.ok(!/[—–]/.test(withFolder), 'no dashes in the copy')

const without = filesBlock({ businessName: 'Mama Ade', driveFolderUrl: null })
assert.ok(without.includes('Simply reply to this email') && !without.includes('Open your Quadem folder'), 'without a folder, the email reads as before')

assert.ok(checklistIntro({ driveFolderUrl: url }).includes(url), 'the checklist gives the folder link')
assert.ok(checklistIntro({}).includes('You can share files via WhatsApp'), 'and without one, reads as before')
console.log('client folder: ok')
