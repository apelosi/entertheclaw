/**
 * Pulse / optional stdio client config.
 * Prefer ETC_API_URL=`{origin}/api` (unversioned). Legacy `…/api/v1` and ETC_ORIGIN accepted.
 */
const apiKey = process.env.ETC_API_KEY?.trim() ?? '';
/** Public unversioned API prefix agents should use. */
const PUBLIC_API_PREFIX = '/api';
function resolveBaseUrl() {
    const apiUrl = process.env.ETC_API_URL?.trim();
    if (apiUrl) {
        const trimmed = apiUrl.replace(/\/$/, '');
        // Legacy versioned base still works (hits /api/v1 routes directly).
        if (/\/api\/v\d+$/.test(trimmed))
            return trimmed;
        // Unversioned public base: …/api
        if (/\/api$/.test(trimmed))
            return trimmed;
        // Bare origin mistakenly placed in ETC_API_URL.
        return `${trimmed}${PUBLIC_API_PREFIX}`;
    }
    const origin = process.env.ETC_ORIGIN?.trim();
    if (origin) {
        return `${origin.replace(/\/$/, '')}${PUBLIC_API_PREFIX}`;
    }
    return '';
}
const baseUrl = resolveBaseUrl();
export const config = {
    apiKey,
    baseUrl,
    statePath: process.env.ETC_STATE_PATH ?? `${process.env.HOME}/.config/entertheclaw/state.json`,
};
if (!apiKey) {
    console.error('ETC_API_KEY is required. Generate a key at your site /agents/invite (same host as ETC_API_URL).');
    process.exit(1);
}
if (!baseUrl) {
    console.error('ETC_API_URL is required (unversioned), e.g. http://host.docker.internal:3000/api or https://entertheclaw.com/api.');
    console.error('Legacy ETC_API_URL=…/api/v1 and ETC_ORIGIN are still accepted. Do not pin /api/vN in new agent config.');
    console.error('Set it in the pulse/runtime env — not in Next.js .env.local or Netlify.');
    process.exit(1);
}
