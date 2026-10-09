# To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
# From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile

FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && corepack prepare pnpm@9.15.4 --activate && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

# Keeps an open admin tab working across a deploy. Every admin form talks to
# the server through one Next.js server action, and Next names it with a hash
# salted by this key. Left unset, each build invents a new key, so a tab opened
# before a deploy calls a name the new build does not know: the server answers
# 404 and the form ignores it. On 2026-10-04 that made "Add Signer" do nothing,
# fifty clicks in a row, after another push redeployed the CMS. Railway passes
# the service variable in as a build argument only because it is declared here.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && corepack prepare pnpm@9.15.4 --activate && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# ffmpeg and ffprobe are what src/lib/videoPipeline.ts shells out to. Without
# them an uploaded video is stored and served exactly as it came off a camera,
# which is routinely ten times the bytes a browser needs. The pipeline reports
# a clear failure rather than crashing if they are missing, so a container
# built without this line degrades quietly, which is the reason to be explicit
# about it here.
RUN apk add --no-cache ffmpeg

# LibreOffice's presentation part turns a PowerPoint deck into a PDF, so a
# video pitch can be presented from the .pptx itself (src/lib/deckConvert.ts,
# 9 October 2026). The fonts stand in for the ones PowerPoint decks use most,
# at the same widths, so text wraps where it did: Liberation for Arial, Times
# New Roman and Courier New, Carlito for Calibri, Noto for everything else.
#
# libreoffice-writer is not optional, though nothing here opens a text
# document. On Alpine, Impress without it dies at start-up, before reading the
# file: "terminate called after throwing an instance of
# 'com::sun::star::uno::RuntimeException'", exit 134. That was the first live
# deck on 9 October 2026. Draw, Calc or the common package do not fix it;
# Writer does (checked in a node:24-alpine container, LibreOffice 25.8.7.3).
RUN apk add --no-cache libreoffice-impress libreoffice-writer font-liberation font-carlito font-noto

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Remove this line if you do not have this folder.
#
# The --chown is not cosmetic, and this was the one COPY in the file without it.
# The repository lives on an exFAT volume, which reports every file as
# rwx------, and COPY preserves that mode. Left unowned these land as root while
# the server runs as nextjs, so Next stats the file, answers with its real
# content type and last-modified, then cannot read it and returns 500. The admin
# logo was a 500, not a 404, for exactly that reason, while /_next/static, which
# is chowned below, served normally from the same container.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The standalone trace above only includes deps reachable from app routes.
# `payload migrate` is invoked separately at container startup and needs its
# own CLI tooling (tsx, drizzle) plus the raw TS config/collections, neither
# of which Next's trace picks up. Layer in the full node_modules and src/ on
# top so migrations can run before the server starts.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

# Railway sets PORT at runtime (default 8080). Do not hardcode it: let the
# platform variable take precedence so the proxy routes to the right port.
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "node_modules/.bin/payload migrate && node server.js"]
