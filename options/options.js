const KEYS = ['esl', 'blast', 'iem', 'major', 'other'];

async function init() {
  const { calendarFilter } = await chrome.storage.sync.get('calendarFilter');
  const filter = calendarFilter ?? {};
  KEYS.forEach(key => {
    const el = document.querySelector(`[data-key="${key}"]`);
    if (el && key in filter) el.checked = filter[key];
  });
  document.querySelector('.save-btn').addEventListener('click', save);
}

async function save() {
  const filter = {};
  KEYS.forEach(key => {
    const el = document.querySelector(`[data-key="${key}"]`);
    if (el) filter[key] = el.checked;
  });
  await chrome.storage.sync.set({ calendarFilter: filter });
  const msg = document.getElementById('saved-msg');
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 2000);
}

init().catch(console.error);
