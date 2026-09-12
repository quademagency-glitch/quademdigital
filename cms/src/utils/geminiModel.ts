/*
  Which Gemini model to call, in one place and overridable without a deploy.

  On 12 September 2026 every call to `gemini-2.5-flash` started coming back 404:

    This model models/gemini-2.5-flash is no longer available to new users.
    Please update your code to use models/gemini-3.6-flash

  That name was written into two files, and both had been quietly failing: the
  proposal parser, on its first ever run, and the onboarding document email
  drafter, which had probably been broken for a while and never says so on
  screen. A model name is not a constant, it is a moving target with a
  deprecation clock, so it lives here and reads from the environment first.

  Set GEMINI_MODEL on Railway to move to a new model without touching code.
*/
export const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash'
