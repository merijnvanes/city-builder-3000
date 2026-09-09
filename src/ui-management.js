import { categoryArt } from './ui-chrome.js';

export function createManagementHub(entries) {
  const dialog = document.createElement('dialog');
  dialog.className = 'management-hub'; dialog.setAttribute('aria-label', 'City management');
  const header = document.createElement('header'); header.className = 'modal-header';
  const title = document.createElement('div');
  title.innerHTML = '<div class="hub-eyebrow">Mayor’s office</div><h2 class="modal-title">City management</h2>';
  const close = document.createElement('button'); close.className = 'btn btn-icon';
  close.textContent = '×'; close.setAttribute('aria-label', 'Close city management');
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);
  const body = document.createElement('div'); body.className = 'modal-body';
  const intro = document.createElement('p'); intro.className = 'hub-intro';
  intro.textContent = 'Plan the next chapter. Keep the books balanced, hear your advisors and work with your neighbours.';
  const grid = document.createElement('div'); grid.className = 'management-grid';
  for (const entry of entries) {
    const button = document.createElement('button'); button.className = 'management-card';
    button.setAttribute('aria-label', entry.accessibleLabel || entry.label);
    const art = document.createElement('span'); art.className = 'management-art'; art.innerHTML = categoryArt(entry.art);
    const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = entry.label;
    const description = document.createElement('small'); description.textContent = entry.description;
    copy.append(name, description); button.append(art, copy);
    button.addEventListener('click', () => { dialog.close(); entry.open(); }); grid.appendChild(button);
  }
  body.append(intro, grid); dialog.append(header, body);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  return { dialog, grid };
}
