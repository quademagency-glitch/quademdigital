# Welcome pack PDF redesign, 26 September 2026

The user reported that the welcome-email attachment was poorly designed and
should be a PDF. The welcome document is now generated as a branded PDF with
embedded Inter fonts, an opening panel, structured project details, practical
next steps and a clear contact panel. The copy uses Ernest's voice. Payment
terms refer to the signed agreement instead of assuming every project is
billed monthly. Long fields and notes flow onto continuation pages.

The live generator uses pdf-lib and embedded font data, with no browser, office
converter, external font fetch or Python dependency at email-send time. The
font licence is included. Agreement and setup document formats are unchanged.

The welcome file uses a versioned automation key, `.pdf` filename and
`application/pdf` upload type. The email explicitly identifies the PDF and
sends the attachment with `application/pdf`. Legacy Word welcome attachments
are refused rather than silently sent on an old retry; regenerate the welcome
file before retrying such a legacy send. Completed historical runs are not
restarted or altered.

## Validation and delivery

- 52 regression tests passed, including real PDF generation/upload and the
  welcome attachment's filename, MIME type and legacy-format rejection.
- PDF module type check and production builds passed. All release guards
  passed; the global-page guard was rerun against production because the
  default localhost server was absent.
- The normal PDF has two pages. A long-field fixture has four. Text bounds
  passed for both. Both rendered pages of the final production-generated PDF
  were inspected with no clipping or overlap.
- Production deployment dpl_EmEnipSUGf1Cx7GEMq8xGx6BNpXo is READY and was
  verified through quademdigital.com before the live test.
- Existing QA client 17 was used. PDF document 7 was saved and downloaded from
  the authenticated CMS, rendered and reviewed before sending.
- Only a corrected welcome email was sent. Other onboarding steps and their
  scheduled emails were not restarted or resent.
- Resend email 01a0e027-f231-74c2-a475-2b451c8ec0a0 is marked delivered to
  ernest@quademdigital.com. Its attachment is the 16,042-byte PDF with confirmed
  `application/pdf` content type. Provider delivery is receiving-server
  acceptance, not proof of inbox placement.

Source is committed locally as d230bf2e on top of 20cf1eb0. The earlier GitHub
push approval is still pending; no push was attempted during this correction.
The live release is deployed, but future Git deployments need these commits.

The checked production PDF is in output/pdf/Quadem-Digital-Welcome-Pack.pdf.
Evidence is in docs/qa/welcome-pack-pdf-2026-09-26.json. No client portal access
codes or private download URLs are stored in the evidence file.
