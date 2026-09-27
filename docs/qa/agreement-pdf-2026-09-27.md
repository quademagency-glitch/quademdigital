# Service agreement PDF, 27 September 2026

Converted the existing QA agreement to a three-page branded PDF. Every original
paragraph matches extracted PDF text, including the 26 September date, QA
nonbinding terms and payment placeholder. Signature fields remain blank.
All pages were visually inspected; text bounds and cedi glyph rendering pass.

Future agreement generation and attachments now use application/pdf. The saved
agreement key is versioned with /pdf-v1 and legacy Word attachments are refused.
Setup instructions remain in their existing format.

QA client 17: PDF document 8, 19,522 bytes. Provider message
01a0e04a-6122-738e-852c-b3cb0c1c547c is scheduled for
2026-09-27 01:33:24.733 UTC to ernest@quademdigital.com, with the PDF filename,
MIME type and size verified. Old scheduled DOCX message
01a0e011-00f0-7643-8e6d-d122c503a3d3 is confirmed canceled.
Other emails were not resent or rescheduled. Delivery is not yet claimed.

Local source commit f758295d. Production deployment
dpl_7xKXmKS2ywK1a5P3yrRZrsGPHG9A is READY and assigned to quademdigital.com.
52 tests, scoped TypeScript check and production build pass. Release guards
pass with the global guard checked separately against the live URL; its
localhost default had no server. Git push remains pending the earlier explicit
approval request, and was not retried.

PDF: output/pdf/Quadem-Digital-Service-Agreement.pdf.
Evidence: docs/qa/agreement-pdf-2026-09-27.json.
Resumable state: /tmp/quadem-agreement-pdf-qa.json. Do not resend.
