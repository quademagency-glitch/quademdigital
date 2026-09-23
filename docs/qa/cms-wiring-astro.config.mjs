import config from '../../astro.config.mjs';

// The browser test targets the public application, not Astro's developer UI.
export default { ...config, devToolbar: { enabled: false } };
