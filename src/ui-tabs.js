// Native buttons with roving focus keep palette tabs usable from the keyboard.
export function createTabs(id, label, entries) {
  const root = document.createElement('div'); root.className = 'palette-pages';
  const strip = document.createElement('div'); strip.className = 'palette-tabs';
  strip.setAttribute('role', 'tablist'); strip.setAttribute('aria-label', label);
  root.appendChild(strip);
  const tabs = entries.map((entry, index) => {
    const button = document.createElement('button');
    button.className = 'palette-tab'; button.textContent = entry.label;
    button.id = `${id}-tab-${entry.id}`;
    button.setAttribute('role', 'tab');
    entry.panel.id = `${id}-page-${entry.id}`;
    button.setAttribute('aria-controls', entry.panel.id);
    entry.panel.setAttribute('role', 'tabpanel');
    entry.panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % entries.length : event.key === 'ArrowLeft' ? (index + entries.length - 1) % entries.length : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); event.stopPropagation(); select(next); tabs[next].focus();
    });
    strip.appendChild(button); root.appendChild(entry.panel);
    return button;
  });
  function select(index) {
    tabs.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1;
      entries[i].panel.hidden = i !== index;
    });
  }
  select(0);
  return { root };
}
