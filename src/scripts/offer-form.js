/*
  The claim form on the offer pages (the free check-up and the two Ghana
  offers). One copy, shared by the new check-up page and the older offer
  layout, so a fix lands on both.

  Wired on the first run and again on every astro:page-load, once per form.
  Until 26 October 2026 it waited for DOMContentLoaded, which this site's view
  transitions never fire again: a visitor who reached the page from a button
  elsewhere on the site (nearly everyone) got a form nothing listened to, and
  the claim never reached /api/submit-form. See commit 17cbad51.

  The ids are the contract with the markup: offerContactForm, offerSource,
  offerMagnetRequested, offerName, offerEmail, offerPhone, offerCompany,
  offerDetails, submitBtn, formSuccessMessage, formErrorMessage.
*/

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
    'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'grr.la',
    'sharklasers.com', 'tempmail.com', 'throwaway.email', 'yopmail.com',
    'spam4.me', 'trashmail.com', 'trashmail.me', 'fakeinbox.com', 'getnada.com',
    'maildrop.cc', '10minutemail.com', 'temp-mail.org', 'dispostable.com',
    'nada.email', 'getairmail.com', 'filzmail.com', 'spamgourmet.com',
    'spamgourmet.net', 'spamgourmet.org', 'mailnull.com', 'spamfree24.org',
    'mytrashmail.com', 'throwam.com', 'tempr.email', 'discard.email',
    'mailnesia.com', 'trashmail.at', 'trashmail.io', 'crap.email',
]);

function isValidEmail(email) {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) return { valid: false, reason: 'Please enter a valid email address.' };
    const domain = trimmed.split('@')[1].toLowerCase();
    if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, reason: 'Disposable email addresses are not allowed.' };
    return { valid: true };
}

const value = (id) => document.getElementById(id)?.value;

export function initOfferForm() {
    const form = document.getElementById('offerContactForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const successMsg = document.getElementById('formSuccessMessage');
    const errorMsg = document.getElementById('formErrorMessage');
    const submitBtn = document.getElementById('submitBtn');
    const submitLabel = submitBtn ? submitBtn.innerHTML : '';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorMsg) errorMsg.style.display = 'none';

        const source = value('offerSource') || 'lead-magnet';
        const magnetRequested = value('offerMagnetRequested');
        const name = value('offerName');
        const email = value('offerEmail');
        const phone = value('offerPhone');
        const company = value('offerCompany');
        const details = value('offerDetails');

        const emailCheck = isValidEmail(email || '');
        if (!emailCheck.valid) {
            if (errorMsg) {
                errorMsg.textContent = emailCheck.reason || 'Invalid email address.';
                errorMsg.style.display = 'block';
            }
            return;
        }

        if (submitBtn) {
            submitBtn.innerHTML = 'Submitting...';
            submitBtn.style.opacity = '0.7';
            submitBtn.style.pointerEvents = 'none';
        }

        // Structured, not a newline-delimited string. Leads.metadata is a json
        // field, so phone and company stay queryable.
        const metadata = {};
        if (phone) metadata.phone = phone;
        if (company) metadata.company = company;
        if (details) metadata.details = details;

        try {
            const response = await fetch('/api/submit-form/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source,
                    magnetRequested,
                    name,
                    email,
                    message: 'I would like to claim this offer.',
                    leave_empty: form.querySelector('input[name="leave_empty"]')?.value || undefined,
                    // The offer itself is delivered either way. This only
                    // decides whether they also join the list.
                    newsletterOptIn: !!form.querySelector('input[name="newsletterOptIn"]')?.checked,
                    metadata: Object.keys(metadata).length ? metadata : undefined,
                }),
            });
            if (!response.ok) throw new Error('Server returned an error');
            form.style.display = 'none';
            if (successMsg) successMsg.style.display = 'block';
        } catch (err) {
            console.error('Form submission error:', err);
            if (errorMsg) {
                errorMsg.textContent = 'Something went wrong. Please try again.';
                errorMsg.style.display = 'block';
            }
            if (submitBtn) {
                submitBtn.innerHTML = submitLabel;
                submitBtn.style.opacity = '1';
                submitBtn.style.pointerEvents = 'auto';
            }
        }
    });
}
