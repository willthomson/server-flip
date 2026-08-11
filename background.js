import {
  canonicalKey,
  classify,
  getState,
  isLoopback,
  originOf,
  swap,
  withLearned,
} from './lib/origin.js';

/**
 * Badge styling per state. The badge is doing the real work here: the whole
 * point is knowing which server you're looking at without having to squint at
 * the address bar.
 */
const STATES = {
  local: { text: 'L', bg: '#15803d' },
  staging: { text: 'S', bg: '#b45309' },
};

const NO_MATCH = { text: '?', bg: '#9a3412' };      // nothing known, no canonical
const HALF_LEARNT = { text: '1/2', bg: '#1d4ed8' }; // one side stored, click the other

async function setBadge(tabId, text, bg) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: bg });
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
      }
    }
  } catch {
    // Tab closed mid-flight. Nothing to badge.
  }
}

async function refreshBadge(tab) {
  if (!tab || tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) return;
  const { pairs } = await getState();
  const match = classify(tab.url, pairs);
  if (match) {
    await setBadge(tab.id, STATES[match.side].text, STATES[match.side].bg);
  } else {
    await setBadge(tab.id, '', null);
  }
}

async function refreshAllBadges() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(refreshBadge));
}

/** Briefly show a badge, then put the real one back. */
function flash(tab, { text, bg }) {
  setBadge(tab.id, text, bg);
  setTimeout(() => refreshBadge(tab), 1600);
}

/**
 * Read the page's canonical hostname. Needs the "scripting" permission plus
 * activeTab, which the user's click on the icon grants for this one tab only.
 * Returns null on pages without a canonical or where scripts can't run
 * (chrome://, the Web Store, PDFs...).
 */
async function readCanonicalHost(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.querySelector('link[rel~="canonical" i]')?.href ?? null,
    });
    return result?.result ? canonicalKey(result.result) : null;
  } catch {
    return null;
  }
}

async function flip(tab) {
  if (!tab || tab.id === undefined) return;

  const state = await getState();
  const origin = originOf(tab.url);

  // The canonical is the source of truth when it exists: both environments
  // render the production hostname in it, so it identifies the project no
  // matter which origin we happen to be on – including a localhost port that
  // served a different project yesterday.
  const key = origin ? await readCanonicalHost(tab.id) : null;

  if (key) {
    const side = isLoopback(origin) ? 'local' : 'staging';
    const learned = withLearned(state.learned, key, side, origin);
    await chrome.storage.sync.set({ learned });

    const pair = learned[key];
    const other =
      (side === 'local' ? pair.staging : pair.local) ??
      // Fall back to the manual pair for the missing side, so a configured
      // localhost works on a project's very first click from staging.
      (side === 'local' ? state.manual.staging : state.manual.local);

    if (other && other !== origin) {
      const url = new URL(tab.url);
      await chrome.tabs.update(tab.id, { url: `${other}${url.pathname}${url.search}${url.hash}` });
      return;
    }

    // First half of a new project learnt. Click the icon on the other server
    // (same project, any page) to complete the pair.
    flash(tab, HALF_LEARNT);
    return;
  }

  // No canonical to go on: fall back to plain origin matching against
  // everything already known (learnt pairs, then the manual pair).
  const next = swap(tab.url, state.pairs);
  if (next) {
    await chrome.tabs.update(tab.id, { url: next });
    return;
  }

  if (state.pairs.length === 0) {
    chrome.runtime.openOptionsPage();
    return;
  }

  flash(tab, NO_MATCH);
}

chrome.action.onClicked.addListener(flip);

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'flip-server') return;
  const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  await flip(target);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') refreshBadge(tab);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await refreshBadge(await chrome.tabs.get(tabId));
  } catch {
    // Tab vanished between the event and the lookup.
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') refreshAllBadges();
});

chrome.runtime.onStartup.addListener(refreshAllBadges);

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await refreshAllBadges();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
