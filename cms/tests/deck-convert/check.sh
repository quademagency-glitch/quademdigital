#!/bin/sh
# A PowerPoint deck turned into a PDF on the CMS's own base image, by the live
# code, as the live server's user. Run by .github/workflows/tests.yml with the
# LibreOffice and font packages read from cms/Dockerfile, so the two cannot
# drift apart.
#
# Why it exists: the CMS tests stand in for LibreOffice. On 9 October 2026
# they all passed while the live server could not start it (Impress on Alpine
# needs the Writer package), and the first real deck failed.
set -eu
apk add --no-cache $1 poppler-utils >/dev/null
adduser -S -u 1001 nextjs
mkdir -p /tmp/deck/out
cp /src/cms/tests/deck-convert/sample-deck.pptx /tmp/deck/
chown -R nextjs /tmp/deck
pdf=$(su -s /bin/sh nextjs -c "node /src/cms/tests/deck-convert/convert.mjs /tmp/deck/sample-deck.pptx /tmp/deck/out")
pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
echo "$pdf: $pages pages"
[ "$pages" = 4 ] || { echo "Expected 4 pages, one a slide"; exit 1; }
