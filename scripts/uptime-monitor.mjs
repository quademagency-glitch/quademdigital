/*
  The hourly uptime check (team portal spec 14.11), run by
  .github/workflows/uptime.yml from GitHub, outside Quadem's own servers, so it
  notices when the CMS itself is down.

  It checks the website, the team portal and the CMS: that each answers, that
  the CMS's scheduled jobs are running without errors (/api/ops-health, which
  needs OPS_MONITOR_SECRET and shows only counts), and that every CMS route
  still answers as it should (cms/scripts/smoke-test.mjs, public reads only).
  Each check gets a second try before it counts. When something is still wrong
  it emails Ernest through Resend, once per problem per hour; no client data
  is ever in the email.

  Local dry run: MONITOR_DRY_RUN=true node scripts/uptime-monitor.mjs
*/
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'

const run = promisify(execFile)
const site = process.env.SITE_URL || 'https://quademdigital.com'
const portal = process.env.PORTAL_URL || 'https://team.quademdigital.com'
const cms = process.env.CMS_URL || 'https://cms.quademdigital.com'
const problems = []

async function check(name, url, options = {}, expected = 200) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 30_000))
    try {
      const res = await fetch(url, { redirect: 'follow', ...options, signal: AbortSignal.timeout(25_000) })
      if (res.status === expected) return
      if (attempt) problems.push(`${name}: answered ${res.status}`)
    } catch {
      if (attempt) problems.push(`${name}: no answer within 25 seconds`)
    }
  }
}

async function smokeTest() {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 30_000))
    try {
      await run(process.execPath, ['cms/scripts/smoke-test.mjs'], { timeout: 240_000 })
      return
    } catch (err) {
      if (attempt) {
        const failed = String(err.stdout ?? '').split('\n').filter((l) => /✗|FAIL|failed/i.test(l)).slice(0, 8)
        problems.push(`CMS routes: ${failed.length ? failed.join('; ') : 'the smoke test did not finish'}`)
      }
    }
  }
}

await Promise.all([
  check('Website home page', `${site}/`),
  check('Team portal sign-in', `${portal}/login`),
  check('Team portal phone app (manifest)', `${portal}/manifest.webmanifest`),
  check('Team portal offline page', `${portal}/offline.html`),
  check('CMS sign-in', `${cms}/admin/login`),
  check('CMS scheduled jobs and errors', `${cms}/api/ops-health`, { headers: { Authorization: `Bearer ${process.env.OPS_MONITOR_SECRET || ''}` } }),
  smokeTest(),
])

const report = { checkedAt: new Date().toISOString(), ok: !problems.length, problems }
if (problems.length && process.env.MONITOR_DRY_RUN !== 'true') {
  if (!process.env.RESEND_API_KEY || !process.env.MONITOR_TO) throw new Error('Something is down, and the alert email cannot be sent: RESEND_API_KEY or MONITOR_TO is missing.')
  const hour = report.checkedAt.slice(0, 13)
  const key = createHash('sha256').update(problems.join('\n')).digest('hex').slice(0, 20)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `quadem-uptime-${hour}-${key}` },
    body: JSON.stringify({
      from: 'Quadem Operations <ernest@quademdigital.com>',
      to: [process.env.MONITOR_TO],
      subject: 'Quadem needs attention',
      text: `The hourly check found:\n\n${problems.join('\n')}\n\nChecked at ${report.checkedAt}. Railway (CMS) and Vercel (website, team portal) have the logs. No client data is in this email.`,
    }),
  })
  if (!res.ok) throw new Error(`The alert email was refused (HTTP ${res.status}).`)
  report.alert = 'sent'
}
console.log(JSON.stringify(report, null, 2))
if (problems.length) process.exitCode = 1
