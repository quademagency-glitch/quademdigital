# Enquiry and onboarding delivery test, 26 September 2026

The user authorised ernest@quademdigital.com for the remaining real delivery
check. The test uses the marker `QA delivery 2026-09-26`. Marketing consent is
false. QA documents state that no binding agreement, billable work, payment or
action is required. The GHc 1 amount is a validation placeholder, not an invoice.

## Consent correction

The enquiry previously recorded an unticked checkbox as pending in Payload,
but still created a subscribed Resend contact and fired `lead.created`.
`src/pages/api/submit-form.ts` now requires an existing confirmed subscription
and the suppression check before either marketing operation. Unconfirmed
opt-ins still receive the confirmation request; transactional enquiry receipt
and owner notification remain separate.

Validation: 49 regression tests passed, including 12 consent-state cases.
Frontend production build passed. The first nine `check:all` guards passed;
the final global-page guard could not reach the absent local server, then
passed separately against https://quademdigital.com/global/. Whitespace clean.

Production deployment `dpl_BU5Gp8W3FinD7A6wshjSYmmJT1Yb` is READY and was
verified through the quademdigital.com alias before the live test.

## Live evidence

Lead 35 was captured with a signed token and enriched successfully without
creating another enquiry. Both enquiry emails were marked delivered by Resend
at the first provider check. Neither email's body nor authentication tokens
are saved in this report.

The address was absent from the Resend audience before and after the enquiry.

Lead 35 converted to client 17. The client correctly stopped at `needs-review`
for the missing agreed service, price and start date. Subsequent QA details triggered the normal durable onboarding queue.
The completed result is recorded below.

Provider delivery means the receiving mail server accepted the message. It
does not establish inbox placement, reading or completion of scheduled sends.

## Live onboarding failure found and corrected

The first worker run failed while filing the agreement (HTTP 400), before any
onboarding email was sent. A direct reproduction returned `Related Client`
validation failure. Retrying the same document key with the client's numeric
ID succeeded (document 4). Payload's Postgres relationship validator rejects
the string ID carried in the worker's serialised snapshot.

`src/pages/api/client-won.ts` now validates and serialises the related client ID
as a positive safe integer. The worker keys remain unchanged. A regression test
exercises new-document generation and multipart upload, including the numeric
relationship value. All 50 regression tests pass. The retry will reuse document
4 through its existing unique automation key rather than uploading it again.

## Completed result

A parallel Git-triggered release, `dpl_7XTuQBtej3nvRrJVv5D6J78TKjrR`, replaced
the first corrected deployment. It was missing the uncommitted form/upload
fixes. They are now committed locally as `20cf1eb0`, preserving the newer CMS
pitch commit `4fd29051`. The Git push was rejected by automatic approval review;
explicit user approval is pending. No push was made.

The restored production deployment is `dpl_BdMhTknVF3cPQcQJMV8aKGVfDU3d`,
READY and assigned to quademdigital.com at the final check. Its production
build passed. Source corrections remain live, but must also be pushed to keep
future Git builds from omitting them.

The remaining test job (6) was isolated in a uniquely named QA queue and run
through Payload's job endpoint. No other client's job was run manually.
Client 17 reached `complete`, with all eight checkpoints recorded. The saved
agreement was reused; welcome document 5 and setup document 6 were created.
There is exactly one matching QA lead and one matching QA client.

All three authenticated attachment downloads succeeded. Their ZIP integrity,
document XML and QA markers passed; the agreement includes explicit nonbinding
terms. Resend lists the matching attachment filename and byte size on each of
the welcome, agreement and setup messages. This is file/content verification,
not a rendered-layout review.

Resend status at 23:34:33 GMT on 26 September:

| Message | Provider status | Scheduled delivery, Ghana/GMT |
| --- | --- | --- |
| Enquiry receipt | Delivered | Immediate |
| New-lead owner notification | Delivered | Immediate |
| Welcome pack | Delivered | Immediate |
| New-client owner notification | Delivered | Immediate |
| Service agreement | Scheduled | 27 September, 01:33 |
| Setup instructions | Scheduled | 27 September, 23:33 |
| Week-one check-in | Scheduled | 3 October, 23:33 |

All seven messages use the authorised inbox and include the QA marker in their
content. Subscriber 23 remains pending with no consent date; the Resend audience
lookup returns 404 (no contact). No newsletter signup or marketing event was
initiated by the corrected enquiry handler. No invoice or payment was created.

The labelled QA records and provider schedules are retained for traceability.
Actual inbox placement and future scheduled delivery remain unverified.
Evidence: `docs/qa/enquiry-delivery-2026-09-26.json`. No access codes, lead tokens,
email bodies or private attachment download links are included in that file.
