/** Count a captured enquiry once, even when the wizard later adds its budget. */
export function recordLeadSuccess(state, track, details, { partial = false, wizard = false } = {}) {
    if (state.leadTracked !== 'true') {
        track('generate_lead', { ...details, stage: partial ? 'partial' : 'complete' });
        state.leadTracked = 'true';
    }
    if (!partial) {
        track('enquiry_completed', details);
        if (wizard) track('wizard_completed', details);
    }
}
