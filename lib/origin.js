/**
 * Shared URL helpers. Imported by both the service worker and the options page
 * so the two can never disagree about what a valid origin looks like.
 */

export const DEFAULTS = {
  staging: '',
  local: 'http://localhost:4007',
};

const LOOPBACK = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Chrome's URL parser is happy to percent-encode its way out of trouble, so
 * "not a url" becomes the perfectly valid host "not%20a%20url". Check the
 * hostname ourselves: labels of letters, digits and hyphens, or an IPv6 literal.
 */
const VALID_HOST =
  /^(\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.?)$/i;

/**
 * Turn whatever someone typed into a clean origin, or null if it can't be read.
 * Bare hosts get a scheme guessed for them: http for loopback, https otherwise.
 *
 *   "staging.example.dev"  -> "https://staging.example.dev"
 *   "localhost:4007"        -> "http://localhost:4007"
 *   "http://localhost:4007/blog/" -> "http://localhost:4007"
 */
export function toOrigin(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  let candidate = raw;
  if (!HAS_SCHEME.test(candidate)) {
    const authority = candidate.split('/')[0];
    candidate = (LOOPBACK.test(authority) ? 'http://' : 'https://') + candidate;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!VALID_HOST.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Which side of the fence is this URL on? Returns 'staging', 'local' or null. */
export function classify(urlString, config) {
  if (!urlString) return null;
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (config.local && url.origin === config.local) return 'local';
  if (config.staging && url.origin === config.staging) return 'staging';
  return null;
}

/** Same path, other origin. Returns null if the URL belongs to neither. */
export function swap(urlString, config) {
  const state = classify(urlString, config);
  if (!state) return null;

  const target = state === 'local' ? config.staging : config.local;
  if (!target) return null;

  const url = new URL(urlString);
  return `${target}${url.pathname}${url.search}${url.hash}`;
}

/** Read and normalise the saved settings. */
export async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return {
    staging: toOrigin(stored.staging),
    local: toOrigin(stored.local),
  };
}
