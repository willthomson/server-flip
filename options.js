import { DEFAULTS, toOrigin } from './lib/origin.js';

const SAMPLE_PATH = '/blog/some-long-post-slug/?preview=true';

const form = document.querySelector('#settings');
const stagingInput = document.querySelector('#staging');
const localInput = document.querySelector('#local');
const stagingNote = document.querySelector('#staging-note');
const localNote = document.querySelector('#local-note');
const statusLine = document.querySelector('#status');
const shortcutButton = document.querySelector('#shortcut');

const HINTS = {
  staging: stagingNote.textContent,
  local: localNote.textContent,
};

let statusTimer;

function paintPreview() {
  const staging = toOrigin(stagingInput.value);
  const local = toOrigin(localInput.value);

  document.querySelector('[data-slot="staging-origin"]').textContent =
    staging ?? 'https://your-staging-host';
  document.querySelector('[data-slot="local-origin"]').textContent =
    local ?? 'http://localhost:0000';

  for (const slot of document.querySelectorAll('[data-slot="path"]')) {
    slot.textContent = SAMPLE_PATH;
  }
}

function markField(input, note, key) {
  const value = input.value.trim();
  const parsed = toOrigin(value);

  if (value && !parsed) {
    note.textContent = "That isn't a host I can read. Try something like example.com:3000.";
    note.classList.add('note--error');
    return false;
  }

  note.textContent = HINTS[key];
  note.classList.remove('note--error');
  return true;
}

function showStatus(message, tone = 'ok') {
  clearTimeout(statusTimer);
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
  statusLine.dataset.visible = 'true';
  statusTimer = setTimeout(() => {
    statusLine.dataset.visible = 'false';
  }, 2600);
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  stagingInput.value = stored.staging ?? '';
  localInput.value = stored.local ?? '';
  paintPreview();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const stagingOk = markField(stagingInput, stagingNote, 'staging');
  const localOk = markField(localInput, localNote, 'local');

  if (!stagingOk || !localOk) {
    showStatus('Fix the highlighted field and save again.', 'error');
    return;
  }

  const staging = toOrigin(stagingInput.value);
  const local = toOrigin(localInput.value);

  if (staging && local && staging === local) {
    showStatus('Both fields point at the same origin, so there is nothing to flip.', 'error');
    return;
  }

  // Store the normalised origins so what you see is what gets matched.
  await chrome.storage.sync.set({
    staging: staging ?? '',
    local: local ?? '',
  });

  stagingInput.value = staging ?? '';
  localInput.value = local ?? '';
  paintPreview();

  showStatus(staging && local ? 'Settings saved.' : 'Saved, but you need both origins for the flip to work.');
});

for (const input of [stagingInput, localInput]) {
  input.addEventListener('input', paintPreview);
}

stagingInput.addEventListener('blur', () => markField(stagingInput, stagingNote, 'staging'));
localInput.addEventListener('blur', () => markField(localInput, localNote, 'local'));

shortcutButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

/* ---- Learnt projects ---- */

const learnedList = document.querySelector('#learned-list');
const learnedEmpty = document.querySelector('#learned-empty');

function sideSpan(cls, value, placeholder) {
  const span = document.createElement('span');
  if (value) {
    span.className = cls;
    span.textContent = value;
  } else {
    span.className = `${cls} learned__side--missing`;
    span.textContent = placeholder;
  }
  return span;
}

async function renderLearned() {
  const { learned = {} } = await chrome.storage.sync.get({ learned: {} });
  const entries = Object.entries(learned).reverse(); // newest first
  learnedList.replaceChildren();
  learnedEmpty.hidden = entries.length > 0;

  for (const [key, pair] of entries) {
    const item = document.createElement('li');
    item.className = 'learned__item';

    const name = document.createElement('span');
    name.className = 'learned__key';
    name.textContent = key;

    const sides = document.createElement('span');
    sides.className = 'learned__sides';
    sides.append(
      sideSpan('learned__side--s', pair?.staging, 'staging not learnt'),
      document.createTextNode(' ⇄ '),
      sideSpan('learned__side--l', pair?.local, 'local not learnt'),
    );

    const forget = document.createElement('button');
    forget.type = 'button';
    forget.className = 'learned__forget';
    forget.textContent = 'Forget';
    forget.addEventListener('click', async () => {
      const { learned: current = {} } = await chrome.storage.sync.get({ learned: {} });
      delete current[key];
      await chrome.storage.sync.set({ learned: current });
    });

    item.append(name, sides, forget);
    learnedList.append(item);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'learned' in changes) renderLearned();
});

renderLearned();
load();
