/**
 * Shared URL helpers. Imported by both the service worker and the options page
 * so the two can never disagree about what a valid origin looks like.
 */

export const DEFAULTS = {
  staging: '',
  local: 'http://localhost:4007',
  // Auto-learnt pairs, keyed by the *hostname* of the page's canonical URL.
  // Hostname only, deliberately: environments often disagree about the path in
  // their canonical tags (one may include a section prefix the other omits),
  // but the production hostname is stable across both.
  //   { "prod-site.com": { staging: "https://...", local: "http://localhost:4007" } }
  learned: {},
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

/** The origin of a full URL, or null for anything unparsable / non-http(s). */
export function originOf(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Loopback origins are the "local" side; everything else is "staging". */
export function isLoopback(origin) {
  try {
    return LOOPBACK.test(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Hostname of a canonical URL, used as the learnt-pair key. Null if unusable. */
export function canonicalKey(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Which side of the fence is this URL on, and in which pair?
 * Returns { side: 'staging'|'local', pair, key } or null.
 */
export function classify(urlString, pairs) {
  const origin = originOf(urlString);
  if (!origin) return null;

  for (const entry of pairs) {
    if (entry.pair.local === origin) return { side: 'local', ...entry };
    if (entry.pair.staging === origin) return { side: 'staging', ...entry };
  }
  return null;
}

/** Same path, other origin. Returns null if the URL belongs to no pair. */
export function swap(urlString, pairs) {
  const match = classify(urlString, pairs);
  if (!match) return null;

  const target = match.side === 'local' ? match.pair.staging : match.pair.local;
  if (!target) return null;

  const url = new URL(urlString);
  return `${target}${url.pathname}${url.search}${url.hash}`;
}

/**
 * Read and normalise everything from storage.
 * Returns { manual, learned, pairs } where pairs is the ordered match list for
 * classify/swap: learnt entries newest-first (string keys keep insertion
 * order), then the manual pair as the fallback.
 */
export async function getState() {
  const stored = await chrome.storage.sync.get(DEFAULTS);

  const manual = {
    staging: toOrigin(stored.staging),
    local: toOrigin(stored.local),
  };

  const learned = {};
  const pairs = [];
  for (const [key, value] of Object.entries(stored.learned ?? {}).reverse()) {
    const pair = {
      staging: toOrigin(value?.staging),
      local: toOrigin(value?.local),
    };
    if (!pair.staging && !pair.local) continue;
    learned[key] = pair;
    pairs.push({ key, pair });
  }

  if (manual.staging || manual.local) {
    pairs.push({ key: null, pair: manual });
  }

  return { manual, learned, pairs };
}

/**
 * Record one side of a project's pair under its canonical-host key and return
 * the updated map. Re-inserts the key so the freshest project sorts first,
 * which is what disambiguates a localhost port that has served several
 * projects over time.
 */
export function withLearned(learned, key, side, origin) {
  const existing = learned[key] ?? { staging: null, local: null };
  const next = { ...learned };
  delete next[key];
  next[key] = { ...existing, [side]: origin };
  return next;
}
