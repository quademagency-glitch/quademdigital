/**
 * Starts the jobs queue cron when the server boots.
 *
 * Payload only creates the `autoRun` cron when something initialises it with
 * `cron: true`, and of the routes Payload ships, only the admin panel does
 * that. The REST and GraphQL handlers do not. So without this file the
 * scheduled-publish queue would start on the first admin page load after a
 * deploy and not before: a post scheduled for Saturday morning would publish
 * whenever Ernest next opened the CMS, which is the one thing scheduling is
 * supposed to remove.
 *
 * Next calls `register` once per server process, before any request is
 * handled. The runtime guard is required because it also runs for the edge
 * runtime, where Payload cannot load.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Migrations run as `payload migrate` in the same container before the
  // server starts (see the Dockerfile CMD). That process sets this flag, and
  // a cron holding the event loop open would stop it exiting.
  if (process.env.PAYLOAD_MIGRATING === 'true') return

  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])

  await getPayload({ config, cron: true })
}
