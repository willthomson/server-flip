import { classify, swap, getConfig } from './lib/origin.js';

/**
 * Badge styling per state. The badge is doing the real work here: the whole
 * point is knowing which server you're looking at without having to squint at
 * the address bar.
 */
const STATES = {
  local: { text: 'L', bg: '#15803d' },
  staging: { text: 'S', bg: '#b45309' },
};

const NO_MATCH = { text: '?', bg: '#9a3412' };

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
  const config = await getConfig();
  const state = classify(tab.url, config);
  if (state) {
    await setBadge(tab.id, STATES[state].text, STATES[state].bg);
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

async function flip(tab) {
  if (!tab || tab.id === undefined) return;

  const config = await getConfig();
  if (!config.staging || !config.local) {
    chrome.runtime.openOptionsPage();
    return;
  }

  const next = swap(tab.url, config);
  if (!next) {
    flash(tab, NO_MATCH);
    return;
  }

  await chrome.tabs.update(tab.id, { url: next });
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
  if (area === 'sync' && ('staging' in changes || 'local' in changes)) refreshAllBadges();
});

chrome.runtime.onStartup.addListener(refreshAllBadges);

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await refreshAllBadges();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
