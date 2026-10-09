import { spawn } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/*
  A PowerPoint deck turned into a PDF (9 October 2026), so a video pitch can be
  presented from the .pptx itself. Ernest: "I should be able to upload a
  PowerPoint document and present". A browser cannot draw PowerPoint slides;
  LibreOffice (in the CMS image, cms/Dockerfile) can, and the recorder already
  presents a PDF page by page.

  What does not come across: animations and builds (a PDF is still pages, and
  Share a window is the way to record those), and fonts the server does not
  have, which are swapped for ones of the same width.
*/

/** The kinds of deck taken, by type. The PDF is used as it is; the rest are turned into one. */
export const DECK_TYPES: Record<string, 'pdf' | 'pptx' | 'ppt' | 'odp'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.oasis.opendocument.presentation': 'odp',
}

export const deckKind = (mime: string) => DECK_TYPES[mime.split(';')[0].trim().toLowerCase()] ?? null

let chain: Promise<unknown> = Promise.resolve()
/** One at a time: LibreOffice is heavy, and this process is also the web server. */
const oneAtATime = <T,>(task: () => Promise<T>): Promise<T> => {
  const next = chain.then(task, task)
  chain = next.catch(() => {})
  return next
}

/**
 * `input` as a PDF, written beside it in `outDir`. Each run has its own
 * LibreOffice profile in a temporary folder, so a crashed run cannot leave a
 * lock behind for the next. Stopped after `timeoutMs`.
 */
export function convertToPdf(input: string, outDir: string, timeoutMs = 3 * 60_000): Promise<string> {
  return oneAtATime(async () => {
    const profile = await mkdtemp(join(tmpdir(), 'lo-profile-'))
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          'soffice',
          ['--headless', '--norestore', '--nologo', '--nodefault', '--nolockcheck', '--nofirststartwizard', `-env:UserInstallation=file://${profile}`, '--convert-to', 'pdf', '--outdir', outDir, input],
          { env: { ...process.env, HOME: profile }, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        let err = ''
        proc.stderr.on('data', (d: Buffer) => {
          err = (err + d.toString()).slice(-2000)
        })
        const timer = setTimeout(() => {
          proc.kill('SIGKILL')
          reject(new Error(`LibreOffice took longer than ${Math.round(timeoutMs / 60_000)} minutes and was stopped.`))
        }, timeoutMs)
        proc.on('error', (e) => {
          clearTimeout(timer)
          reject(new Error(`LibreOffice could not be started (is it installed?): ${e.message}`))
        })
        proc.on('close', (code) => {
          clearTimeout(timer)
          if (code === 0) resolve()
          else reject(new Error(`LibreOffice stopped (${code}): ${err.trim().split('\n').slice(-3).join(' | ')}`))
        })
      })
      // It names the PDF after the input; it answers 0 even when it wrote nothing, so look.
      const pdf = (await readdir(outDir)).find((f) => f.toLowerCase().endsWith('.pdf'))
      if (!pdf) throw new Error('LibreOffice wrote no PDF. The file may be damaged or protected with a password.')
      return join(outDir, pdf)
    } finally {
      await rm(profile, { recursive: true, force: true }).catch(() => {})
    }
  })
}
