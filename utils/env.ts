/**
 * Central place for environment-driven configuration.
 *
 * Both URLs default to the public Toolshop demo instance so the suite runs
 * out of the box, but can be pointed at another environment (e.g. a local
 * Docker stack, or a staging deployment) via env vars in CI.
 */
export const UI_BASE_URL = process.env.UI_BASE_URL ?? 'https://practicesoftwaretesting.com';
export const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.practicesoftwaretesting.com';

/**
 * The API issues short-lived access tokens. The assignment brief documents
 * `expires_in: 120`, but a live login against the real API returned
 * `expires_in: 300` - using the empirically observed value here rather than
 * the documented one. Kept as a named constant so the reasoning ("why do we
 * log in right before using the UI, instead of once in a global setup") is
 * discoverable from the code rather than tucked away in a comment nobody
 * reads.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 300;

/** localStorage key the Angular app reads its JWT from (see TokenStorageService). */
export const AUTH_TOKEN_STORAGE_KEY = 'auth-token';
