import { TOOLS, BUILDINGS, ORDINANCES, DISASTERS, FUNDED_DEPARTMENTS, SPECIAL_TYPES, ZONE_TYPES, PORT_TYPES } from "./sim.js";
import { ZONE_COST } from './sim/catalog.js';
import { createPortrait } from "./portrait.js";
import { LOAN_STEP, LOAN_MAX, LOAN_YEARS, MAX_LOANS } from "./sim/economy.js";
import { TOOL_GROUPS } from './ui-tool-groups.js';
import { createTabs } from './ui-tabs.js';
import { createManagementHub } from './ui-management.js';
import { toolPreview } from './ui-tool-preview.js';
import { citySignal, demandSignal, placeServices, inspectNote } from './ui-signals.js';
import { categoryArt, navigationArt, mountNavigatorFrame } from './ui-chrome.js';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ICONS = {
  inspect: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.2" cy="8.2" r="5.2"/><path d="M12 12 17 17"/></svg>`,
  road: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="6.5" y="2" width="7" height="16" rx="1.5" opacity=".85"/><rect x="9.3" y="4.5" width="1.4" height="2" rx=".6" fill="white" opacity=".75"/><rect x="9.3" y="9" width="1.4" height="2" rx=".6" fill="white" opacity=".75"/><rect x="9.3" y="13.5" width="1.4" height="2" rx=".6" fill="white" opacity=".75"/></svg>`,
  rail: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="7" y="2" width="6" height="16" rx="1"/><rect x="4" y="5" width="12" height="2" rx="1" fill="white" opacity=".6"/><rect x="4" y="9" width="12" height="2" rx="1" fill="white" opacity=".6"/><rect x="4" y="13" width="12" height="2" rx="1" fill="white" opacity=".6"/></svg>`,
  bus: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="4" width="14" height="11" rx="2" opacity=".9"/><rect x="5" y="6" width="4" height="3" rx=".8" fill="white" opacity=".5"/><rect x="11" y="6" width="4" height="3" rx=".8" fill="white" opacity=".5"/><rect x="6" y="15" width="3" height="2" rx="1"/><rect x="11" y="15" width="3" height="2" rx="1"/></svg>`,
  residential: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5 2.5 9H5v8.5h3.5V13.5h3V17.5H15V9h2.5L10 2.5z"/></svg>`,
  commercial: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="4.5" width="10" height="13.5" rx="1"/><path d="M5 4.5 7.5 2h5L15 4.5H5z" opacity=".75"/><rect x="7" y="7" width="2" height="2" rx=".4" fill="white" opacity=".6"/><rect x="11" y="7" width="2" height="2" rx=".4" fill="white" opacity=".6"/><rect x="7" y="11" width="2" height="2" rx=".4" fill="white" opacity=".6"/><rect x="11" y="11" width="2" height="2" rx=".4" fill="white" opacity=".6"/></svg>`,
  industrial: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="10" width="16" height="8" rx="1" opacity=".9"/><path d="M2 10V6l5 4V6l5 4V6l6 4.5V10H2z" opacity=".82"/><rect x="5" y="2" width="2" height="5" rx="1" opacity=".6"/><rect x="13" y="2" width="2" height="5" rx="1" opacity=".6"/></svg>`,
  park: `<svg viewBox="0 0 20 20" fill="currentColor"><ellipse cx="10" cy="7.5" rx="5.5" ry="5.5" opacity=".88"/><ellipse cx="5.5" cy="10" rx="4" ry="4.5" opacity=".68"/><ellipse cx="14.5" cy="10" rx="4" ry="4.5" opacity=".68"/><rect x="9.2" y="13" width="1.6" height="5" rx=".8" opacity=".82"/></svg>`,
  landfill: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="12" width="14" height="6" rx="1" opacity=".7"/><path d="M5 12 7 5h6l2 7H5z" opacity=".6"/><path d="M8 8 10 5 12 8" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/></svg>`,
  power: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.8 2 5 11.5h5.5L9 18l8.5-9.5h-6L11.8 2z"/></svg>`,
  powerline: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6 10 3 17 6"/><path d="M5 6v3M15 6v3"/><path d="M5 9 10 11 15 9"/><path d="M10 11v7"/></svg>`,
  pipe: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="8.5" width="16" height="3" rx="1.5" opacity=".85"/><circle cx="5" cy="10" r="2.5" opacity=".7"/><circle cx="15" cy="10" r="2.5" opacity=".7"/></svg>`,
  water: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2C10 2 4 10.5 4 13.8a6 6 0 0 0 12 0C16 10.5 10 2 10 2z" opacity=".9"/><path d="M7.5 14c0-1.8 1.5-3.5 2.5-4.5" stroke="white" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".4"/></svg>`,
  police: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2 3 5.5V11c0 4.5 3.2 7.5 7 8.5 3.8-1 7-4 7-8.5V5.5L10 2z" opacity=".9"/><path d="M10 7.5v3.5M8.5 9.5h3" stroke="white" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8"/></svg>`,
  fire: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="8.5" width="14" height="9.5" rx="1" opacity=".9"/><path d="M3 8.5 5.5 3.5h9L17 8.5H3z" opacity=".78"/><path d="M9 11v4m-2-2h4" stroke="white" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".75"/></svg>`,
  school: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="7" width="14" height="11" rx="1" opacity=".9"/><path d="M3 7 10 2 17 7H3z" opacity=".75"/><rect x="8.5" y="13" width="3" height="5" rx=".5" fill="white" opacity=".45"/><rect x="6" y="9" width="2" height="2" rx=".4" fill="white" opacity=".5"/><rect x="12" y="9" width="2" height="2" rx=".4" fill="white" opacity=".5"/></svg>`,
  hospital: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="5" width="14" height="13" rx="1" opacity=".9"/><path d="M3 5 5.5 2h9L17 5H3z" opacity=".72"/><path d="M10 8v6M7 11h6" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity=".85"/></svg>`,
  bulldoze: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="11.5" width="13" height="4" rx="1" opacity=".9"/><rect x="15" y="9.5" width="3.5" height="8" rx="1" opacity=".72"/><rect x="3" y="7.5" width="9.5" height="5" rx="1" opacity=".82"/><circle cx="5.5" cy="16.5" r="2" opacity=".9"/><circle cx="11" cy="16.5" r="2" opacity=".9"/></svg>`,
  undo: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h8a6 6 0 0 1 0 12H7"/><path d="M3 8 7 4M3 8l4 4"/></svg>`,
};

for (const [id, path] of Object.entries({
  raise: 'M2 12 10 8 18 12 10 16ZM10 8V2M7 5l3-3 3 3',
  lower: 'M2 12 10 8 18 12 10 16ZM10 1v6M7 4l3 3 3-3',
  level: 'M2 12 10 8 18 12 10 16ZM4 4h12',
  makeland: 'M2 12 10 8 18 12 10 16ZM7 4h6M10 1v6',
  makewater: 'M2 14q4-3 8 0t8 0M2 18q4-3 8 0t8 0M10 1C4 7 7 10 10 10s6-3 0-9Z',
  dispatch: 'M2 6h10v9H2ZM12 9h4l2 3v3h-6M5 15v2M15 15v2M5 3h4',
})) ICONS[id] = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="${path}"/></svg>`;

// Icons fall back to a lettered badge so every catalog entry gets a button.
function iconFor(id, label) {
  if (ICONS[id]) return ICONS[id];
  const alias = { coal: "power", oil: "power", gas: "power", nuclear: "power", wind: "power", solar: "power", waterpump: "water", watertower: "water", treatment: "water", railstation: "rail", subway: "rail", substation: "rail", highway: "road", largepark: "park", zoo: "park", tree: "park", college: "school", library: "school", museum: "school", incinerator: "landfill", recycling: "landfill", dispatch: "fire", patrol: "police" }[id];
  if (alias && ICONS[alias]) return ICONS[alias];
  const letter = (label || id).charAt(0).toUpperCase();
  return `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="14" height="14" rx="3" opacity=".35"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${letter}</text></svg>`;
}

function renderSignal(parent, key, value) {
  const signal=citySignal(key,value);
  parent.replaceChildren();
  parent.dataset.tone=signal.tone;
  const icon=el('span','signal-icon');icon.innerHTML=iconFor(signal.icon);icon.setAttribute('aria-hidden','true');
  const text=el('div','signal-copy');
  text.append(el('span','signal-label',signal.label),el('strong','signal-word',signal.word));
  const track=el('div','signal-track');
  track.setAttribute('role','meter');track.setAttribute('aria-label',signal.label);
  track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
  track.setAttribute('aria-valuenow',String(signal.level));track.setAttribute('aria-valuetext',signal.word);
  const fill=el('span');fill.style.width=`${signal.level}%`;track.appendChild(fill);
  parent.append(icon,text);
  if (!signal.neutral) parent.appendChild(track);
}

const PATH_TOOLS = new Set(["road", "rail", "highway", "powerline", "pipe", "subway"]);
const RECT_TOOLS = new Set(["residential", "commercial", "industrial", "airport", "seaport", "park", "landfill", "tree", "bulldoze", "makewater", "makeland", "raise", "lower", "level"]);

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtMoney(v) {
  if (v == null) return "--";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function fmtPop(v) {
  if (v == null) return "--";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

function fmtPct(v) {
  if (v == null) return "--";
  return `${Math.round(v)}%`;
}

// ── DOM helpers ────────────────────────────────────────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function btn(cls, text, title, onclick) {
  const b = el("button", cls, text);
  if (title) { b.title = title; b.setAttribute("aria-label", title); }
  if (onclick) b.addEventListener("click", onclick);
  return b;
}

function svgBtn(cls, id, title, onclick) {
  const b = btn(cls, "", title, onclick);
  b.innerHTML = ICONS[id] || "";
  const lbl = el("span", "tool-label", id === "undo" ? "Undo" : id.charAt(0).toUpperCase() + id.slice(1));
  b.appendChild(lbl);
  return b;
}

// ── SVG history graph ──────────────────────────────────────────────────────────
function buildHistoryGraph(history, key, color, fmt = fmtPop) {
  const W = 460, H = 100, PAD = 10;
  const vals = history.map((h) => (typeof key === "function" ? key(h) : h[key]) ?? 0).filter((v) => !isNaN(v));
  if (!vals.length) return "";
  const mn = Math.min(...vals);
  const mx = Math.max(...vals) || 1;
  const scale = (v) => H - PAD - ((v - mn) / (mx - mn || 1)) * (H - PAD * 2);
  const pts = vals.map((v, i) => `${PAD + (i / (vals.length - 1 || 1)) * (W - PAD * 2)},${scale(v)}`).join(" ");
  const zero = mn < 0 && mx > 0 ? `<line x1="${PAD}" x2="${W - PAD}" y1="${scale(0)}" y2="${scale(0)}" stroke="#7a90a8" stroke-dasharray="3 3" stroke-width=".8"/>` : "";
  return `<svg class="history-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${zero}
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <text x="${PAD}" y="${H - 2}" font-size="8" fill="#7a90a8">${fmt(mn)}</text>
    <text x="${PAD}" y="10" font-size="8" fill="#7a90a8">${fmt(mx)}</text>
  </svg>`;
}

const REPORT_GRAPHS = [
  ["population", "Population", "var(--res)", fmtPop],
  ["money", "Funds", "#40e890", fmtMoney],
  [(h) => h.balance, "Monthly balance", "#8fd0ff", fmtMoney],
  ["happiness", "Approval rating", "#f0d040", fmtPct],
  ["pollution", "Pollution", "#e07040", fmtPct],
  ["crime", "Crime", "#d05060", fmtPct],
  ["traffic", "Traffic", "#80a0c0", fmtPct],
  ["landValue", "Land value", "#60c0a0", fmtPct],
  ["eq", "Education quotient", "#b090e0", (v) => String(Math.round(v))],
  ["lifeExpectancy", "Life expectancy", "#70d0c0", (v) => `${Math.round(v)} yrs`],
];

// ── mountUI ────────────────────────────────────────────────────────────────────
export function mountUI(actions) {
  const app = document.getElementById("app");
  const toolMap = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

  // Resolve groups — filter to only tools actually in TOOLS export
  const groups = TOOL_GROUPS.map((g) => ({
    ...g,
    tools: g.tools.filter((id) => toolMap[id]),
  })).filter((g) => g.tools.length > 0);

  // A right tool rail meets the bottom news and city status strips.
  const commandBar = el('header');
  commandBar.id = 'command-bar';
  commandBar.setAttribute('aria-label', 'City status and time');
  app.appendChild(commandBar);
  const buildConsole = el('section');
  buildConsole.id = 'build-console';
  buildConsole.setAttribute('aria-label', 'City tools');
  const consoleContext = el('div');
  consoleContext.id = 'console-context';
  const consoleDeck = el('div');
  consoleDeck.id = 'console-deck';
  buildConsole.append(consoleContext, consoleDeck);
  app.appendChild(buildConsole);

  // ── City management ────────────────────────────────────────────────────────
  const managementPanel = el("div");
  managementPanel.id = "management-panel";
  commandBar.appendChild(managementPanel);

  // Logo
  const logoMark = el("button");
  logoMark.id = "logo-mark";
  logoMark.innerHTML = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 32V18l8-4v18m0-8V8l9-4v28m0-15 8-4v19m0-10 5-2v12M3 33h34"/><path d="M17 12v3m0 4v3m0 4v3m9-7v3"/></svg>';
  logoMark.setAttribute('aria-label', 'Center view');
  logoMark.title = "Center view";
  logoMark.addEventListener("click", () => actions.home?.());

  // City name remains editable in the bottom status strip.
  const cityName = document.createElement("input");
  cityName.id = "city-name";
  cityName.type = "text";
  cityName.value = "New Riverton";
  cityName.setAttribute("aria-label", "City name");
  cityName.addEventListener("change", () => {
    actions.renameCity?.(cityName.value.trim() || "New Riverton");
  });

  // City management hub
  const hub = createManagementHub([
    { label: 'Budget & finance', accessibleLabel: 'Open budget', art: 'special', description: 'Cash flow, taxes, funding and the yearly ledger.', open: () => { selectBudgetPage(0); budgetDialog.showModal(); } },
    { label: 'City reports', accessibleLabel: 'City report', art: 'zone', description: 'Population, happiness and the health of your city.', open: () => { buildReport(); reportDialog.showModal(); } },
    { label: 'Advisors', art: 'civic', description: 'Hear what your departments need next.', open: () => { buildAdvisors(); advisorDialog.showModal(); } },
    { label: 'Neighbours & contracts', art: 'transport', description: 'Connections and power, water and waste agreements.', open: () => { selectBudgetPage(4); budgetDialog.showModal(); } },
    { label: 'Policies & ordinances', art: 'landmark', description: 'Set the rules that shape daily life.', open: () => { selectBudgetPage(3); budgetDialog.showModal(); } },
  ]);
  app.appendChild(hub.dialog);
  const cityMenu = el('details', 'city-menu');
  const menuSummary = el('summary', 'btn');
  menuSummary.innerHTML = navigationArt('game');
  menuSummary.title = 'Game menu · saves, settings and help';
  menuSummary.setAttribute('aria-label', 'City menu');
  cityMenu.appendChild(menuSummary);
  const menuBody = el('div', 'city-menu-body');
  cityMenu.appendChild(menuBody);
  menuBody.appendChild(btn("btn", "Save city", "Save city", () => actions.save?.()));
  menuBody.appendChild(btn("btn", "Load city", "Load city", () => actions.load?.()));
  menuBody.appendChild(btn("btn", "Saves & files", "Save slots and files", () => { buildFiles(); filesDialog.showModal(); }));
  menuBody.appendChild(btn("btn", "New city", "New city", () => confirmDialog.showModal()));
  menuBody.appendChild(btn("btn", "Disasters", "Disasters", () => disasterDialog.showModal()));
  menuBody.appendChild(btn("btn", "Day / night", "Toggle day/night", () => actions.toggleDay?.()));
  const soundBtn = btn("btn btn-icon", "♫", "Toggle soundtrack", async () => {
    const enabled = await actions.toggleSound?.();
    soundBtn.setAttribute("aria-pressed", String(!!enabled));
  });
  soundBtn.setAttribute("aria-pressed", "false");
  soundBtn.textContent = 'Soundtrack';
  menuBody.appendChild(soundBtn);
  menuBody.appendChild(btn("btn", "How to play", "Help", () => helpDialog.showModal()));
  menuBody.addEventListener('click', e => { if (e.target.closest('button')) cityMenu.open = false; });
  document.addEventListener('pointerdown', e => { if (!cityMenu.contains(e.target)) cityMenu.open = false; });

  menuSummary.addEventListener('click', () => closeFlyout());

  // ── Right tool rail ────────────────────────────────────────────────────────
  const toolbar = el("div");
  toolbar.id = "toolbar";
  consoleDeck.appendChild(toolbar);

  // Status panel: name, date, funds, population, approval, demand, speed.
  const statusPanel = el("div");
  statusPanel.id = "status-panel";
  commandBar.prepend(statusPanel);
  const statusName = el("div", "status-row city-identity");
  statusName.appendChild(logoMark);
  const cityIdentity = el('div', 'city-identity-text');
  cityIdentity.append(el('span', 'city-eyebrow', 'A city in your hands'), cityName);
  statusName.appendChild(cityIdentity);
  const mDate = el("span", "status-date", "--");
  statusPanel.appendChild(statusName);

  const statusFunds = el("div", "status-row status-funds");
  const mMoney = el("span", "status-money", "--");
  const moneyDisplay = mMoney;
  const dateDisplay = mDate;
  const fundsWrap = el('div', 'funds-wrap');
  fundsWrap.append(el('span', 'status-stat-label', 'Cash'), mMoney);
  statusFunds.appendChild(fundsWrap);
  const statusSmall = el("div", "status-small");
  const popWrap = el("span", "status-stat");
  popWrap.appendChild(el("span", "status-stat-label", "Population"));
  const mPop = el("span", "status-stat-val", "--");
  popWrap.appendChild(mPop);
  const happyWrap = el("span", "status-stat");
  happyWrap.appendChild(el("span", "status-stat-label", "Happiness"));
  const mHappy = el("span", "status-stat-val happy", "--");
  happyWrap.appendChild(mHappy);
  const moodTrack=el('span','mood-track');
  moodTrack.appendChild(el('span','mood-fill'));
  happyWrap.appendChild(moodTrack);
  statusSmall.appendChild(popWrap);
  statusSmall.appendChild(happyWrap);
  statusFunds.appendChild(statusSmall);
  statusPanel.appendChild(statusFunds);

  // RCI demand bars
  const rciSection = el("div");
  rciSection.id = "rci-section";
  function rciRow(cls, labelText) {
    const row = el("div", "rci-row");
    row.setAttribute('role', 'meter');
    row.setAttribute('aria-label', `${{ r: 'Residential', c: 'Commercial', i: 'Industrial' }[cls]} demand`);
    row.setAttribute('aria-valuemin', '-100'); row.setAttribute('aria-valuemax', '100');
    row.appendChild(el("span", `rci-lbl ${cls}`, labelText));
    const track = el("div", "rci-track");
    const center = el("div", "rci-center");
    track.appendChild(center);
    const fill = el("div", `rci-fill pos`);
    fill.style.color = cls === "r" ? "var(--res)" : cls === "c" ? "var(--com)" : "var(--ind)";
    track.appendChild(fill);
    row.appendChild(track);
    const val = el("span", "rci-val", "--");
    row.appendChild(val);
    rciSection.appendChild(row);
    return { fill, val };
  }
  const rciR = rciRow("r", "Residential");
  const rciC = rciRow("c", "Commercial");
  const rciI = rciRow("i", "Industrial");
  statusPanel.appendChild(rciSection);
  rciSection.setAttribute('aria-label', 'Demand for residential, commercial and industrial zones');
  rciSection.prepend(el('span', 'demand-label', 'Zone demand'));
  for (const row of rciSection.querySelectorAll('.rci-row')) row.title = 'Left of centre: oversupply. Right of centre: room to grow.';

  // Speed controls
  const speedGroup = el("div");
  speedGroup.id = "speed-group";
  speedGroup.appendChild(mDate);
  const clockState = el('span', 'clock-state', 'Paused');
  speedGroup.appendChild(clockState);
  const speedRow = el("div", "speed-label-row");
  [
    { n: 0, label: "⏸", title: "Pause [0]" },
    { n: 1, label: "▶", title: "Normal [1]" },
    { n: 2, label: "▶▶", title: "Fast [2]" },
    { n: 3, label: "▶▶▶", title: "Very fast [3]" },
  ].forEach(({ n, label, title }) => {
    const b = el("button", n === 0 ? "speed-btn active" : "speed-btn", label);
    b.dataset.speed = String(n);
    b.title = title;
    b.setAttribute("aria-label", title);
    b.setAttribute("aria-pressed", n === 0 ? "true" : "false");
    b.addEventListener("click", () => actions.setSpeed(n));
    speedRow.appendChild(b);
  });
  speedGroup.appendChild(speedRow);
  managementPanel.appendChild(speedGroup);

  // Top tools (inspect + undo)
  const dockTopTools = el("div");
  dockTopTools.id = "dock-top-tools";
  toolbar.appendChild(dockTopTools);

  const inspectBtn = svgBtn("btn tool-btn", "inspect", "Inspect tile [I]", () => { closeFlyout(); actions.selectTool("inspect"); });
  inspectBtn.dataset.tool = "inspect";
  dockTopTools.appendChild(inspectBtn);

  const undoBtn = svgBtn("btn tool-btn", "undo", "Undo [Ctrl+Z]", () => actions.undo?.());
  dockTopTools.appendChild(undoBtn);

  // Scrollable body
  const dockScroll = el("div");
  dockScroll.id = "dock-scroll";
  const dockRail = el('div');
  dockRail.id = 'dock-rail';
  dockRail.appendChild(dockScroll);
  toolbar.appendChild(dockRail);

  // Compact palettes open against the left edge of the rail.
  const flyout = el("div");
  flyout.id = "flyout";
  flyout.setAttribute("role", "region");
  flyout.setAttribute("aria-label", "Tool palette");
  consoleContext.appendChild(flyout);
  const flyoutTitle = el("div", "flyout-title", "");
  const flyoutBody = el("div", "flyout-body");
  flyout.appendChild(flyoutTitle);
  flyout.appendChild(flyoutBody);
  const paletteDetail = el('p', 'palette-detail', 'Choose what to build.');
  flyout.appendChild(paletteDetail);
  flyout.appendChild(btn('panel-close', '×', 'Close tool palette', () => closeFlyout(true)));
  let openGroupId = null;
  function closeFlyout(restoreFocus = false) {
    const trigger = groupEls[openGroupId]?.header;
    flyout.classList.remove("open");
    flyout.querySelectorAll('.tool-art').forEach(image => image.removeAttribute('src'));
    openGroupId = null;
    Object.values(groupEls).forEach((g) => { g.header.classList.remove("open"); g.header.setAttribute("aria-expanded", "false"); });
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  // Inspection shares the compact panel beside the tool rail.
  const inspPanel = el("div");
  inspPanel.id = "inspector-panel";
  inspPanel.setAttribute("aria-live", "polite");
  const inspHeading=el('div','insp-heading');
  const inspHeaderLbl = el("div", "insp-header-label", "Inspect");
  inspHeading.appendChild(inspHeaderLbl);
  inspPanel.appendChild(inspHeading);
  function closeInspector(restoreFocus = true) {
    actions.clearSelection?.(); inspPanel.classList.remove('visible');
    if (restoreFocus) inspectBtn.focus();
  }
  inspHeading.appendChild(btn('panel-close', '×', 'Close inspector', () => closeInspector()));
  const inspPortrait = el("canvas", "insp-portrait");
  const inspOverview = el('div', 'insp-overview');
  inspPanel.appendChild(inspOverview);
  inspOverview.appendChild(inspPortrait);
  const lotCard = createPortrait(inspPortrait);
  const inspTitle = el("div", "insp-title", "--");
  inspOverview.appendChild(inspTitle);
  const inspDesc = el("div", "insp-desc", "");
  inspOverview.appendChild(inspDesc);
  const inspFacts = el('div', 'insp-facts');
  inspOverview.appendChild(inspFacts);
  const inspDetails = el("div");
  inspDetails.className = 'insp-signals';
  inspPanel.appendChild(inspDetails);
  const inspMore=el('details','inspection-notes');
  inspMore.appendChild(el('summary','','More about this place'));
  const inspNotes=el('div');inspMore.appendChild(inspNotes);inspPanel.appendChild(inspMore);
  inspMore.addEventListener('toggle',()=>{if(!inspMore.open)inspPanel.scrollTop=0;});
  let inspectedPlace='';
  consoleContext.appendChild(inspPanel);

  const activeTool = el('section', 'active-tool');
  activeTool.setAttribute('aria-label', 'Selected construction tool');
  const activeTitle = el('div', 'active-tool-title');
  const activeDescription = el('p', 'active-tool-description');
  activeTool.append(activeTitle, activeDescription);
  activeTool.appendChild(btn('panel-close', '×', 'Cancel construction tool', () => {
    actions.selectTool('inspect');
    inspectBtn.focus();
  }));
  consoleContext.appendChild(activeTool);

  // Tool groups
  const toolBtns = {}; // id -> button element
  const groupEls = {}; // groupId -> { header, body, el }

  groups.forEach((g) => {
    const groupEl = el("div", "tool-group");
    groupEl.dataset.group=g.id;
    const header = el("button", "group-header");
    header.setAttribute("aria-label", g.label);
    header.title = g.label;
    header.setAttribute("aria-expanded", "false");
    header.setAttribute('aria-controls', 'flyout');
    const icon = el("span", "group-icon");
    icon.innerHTML = categoryArt(g.art);
    header.appendChild(icon);
    header.appendChild(el("span", "group-label", g.label));
    header.appendChild(el("span", "group-arrow", "▸"));
    groupEl.appendChild(header);

    const body = el("div", "group-body");
    const sections = (g.sections || [{ id: g.id, label: g.label, tools: g.tools }]).map(section => {
      const panel = el('div', 'palette-page');
      const grid = el('div', 'tool-grid'); panel.appendChild(grid);
      if (section.id === 'rewards') panel.appendChild(el('p', 'palette-empty', 'Grow your population to unlock rewards. Business offers arrive through petitions.'));
      return { ...section, panel, grid };
    });

    g.tools.forEach((toolId) => {
      const t = toolMap[toolId];
      if (!t) return;
      const perTile = PATH_TOOLS.has(toolId) || RECT_TOOLS.has(toolId) || BUILDINGS[toolId]?.path || BUILDINGS[toolId]?.rect;
      const costStr = t.cost > 0 ? `${ZONE_TYPES.has(toolId) ? 'From ' : ''}${fmtMoney(t.cost)}${perTile ? '/tile' : ''}` : "Free";
      const b = el("button", "tool-btn");
      b.dataset.tool = toolId;
      b.title = `${t.label}\n${t.description || ""}\nCost: ${costStr}${t.shortcut ? ` [${t.shortcut.toUpperCase()}]` : ""}`;
      b.setAttribute("aria-label", t.label);
      const iconWrap = el("span");
      iconWrap.className = 'tool-visual';
      iconWrap.innerHTML = iconFor(toolId, t.label);
      const preview = toolPreview(toolId);
      if (preview) iconWrap.replaceChildren(preview);
      else iconWrap.classList.add('tool-utility');
      b.appendChild(iconWrap);
      b.appendChild(el("span", "tool-label", t.label));
      b.appendChild(el('span', 'tool-price', costStr));
      b.addEventListener('pointerenter', () => { paletteDetail.textContent = t.description || t.label; });
      b.addEventListener('focus', () => { paletteDetail.textContent = t.description || t.label; });
      b.addEventListener("click", () => {
        actions.selectTool(toolId); closeFlyout(true);
      });
      sections.find(section => section.tools.includes(toolId)).grid.appendChild(b);
      toolBtns[toolId] = b;
    });

    const tabs = g.sections ? createTabs(g.id, `${g.label} categories`, sections) : null;
    body.appendChild(tabs ? tabs.root : sections[0].panel);

    // Density strip for zone group
    if (g.hasDensity) {
      const densityStrip = el("div");
      densityStrip.id = "density-strip";
      const densLbl = el("div", "density-label", "Density");
      densityStrip.appendChild(densLbl);
      const densBtns = el("div", "density-btns");
      [1, 2, 3].forEach((d) => {
        const db = el("button", d === 1 ? "density-btn active" : "density-btn", ['Low', 'Medium', 'High'][d - 1]);
        const skyline=el('span','density-skyline');skyline.setAttribute('aria-hidden','true');
        for(const height of [d*3,d*4+2,d*3+2]) { const tower=el('i');tower.style.height=`${height}px`;skyline.appendChild(tower); }
        db.prepend(skyline);
        db.dataset.density = String(d);
        db.setAttribute("aria-label", `Density ${d}`);
        db.addEventListener("click", () => {
          actions.setDensity?.(d);
          densBtns.querySelectorAll(".density-btn").forEach((b) =>
            b.classList.toggle("active", Number(b.dataset.density) === d),
          );
        });
        densBtns.appendChild(db);
      });
      densityStrip.appendChild(densBtns);
      activeTool.appendChild(densityStrip);
    }

    dockScroll.appendChild(groupEl);

    header.addEventListener("click", () => toggleGroup(g.id));
    groupEls[g.id] = { el: groupEl, header, body, label: g.label, tabs };
  });

  const managementButton = btn('group-header management-button', '', 'City management', () => {
    closeFlyout(); hub.dialog.showModal();
  });
  managementButton.innerHTML = `<span class="group-icon">${categoryArt('civic')}</span><span class="group-label">City management</span>`;
  dockScroll.appendChild(managementButton);

  function toggleGroup(id) {
    if (openGroupId === id) { closeFlyout(); return; }
    expandGroup(id);
  }

  // Open a group's tools beside the rail.
  function expandGroup(id) {
    const g = groupEls[id];
    if (!g) return;
    if (inspPanel.classList.contains('visible')) closeInspector(false);
    overlaySection.classList.remove('open'); overlayToggle.setAttribute('aria-expanded', 'false');
    closeFlyout();
    openGroupId = id;
    flyout.dataset.group = id;
    g.header.classList.add("open");
    g.header.setAttribute("aria-expanded", "true");
    flyoutTitle.textContent = g.label;
    flyoutBody.innerHTML = "";
    flyoutBody.appendChild(g.body);
    paletteDetail.textContent = 'Choose a tool, then click or drag in your city.';
    flyout.querySelectorAll('.tool-art').forEach(image => { image.src = image.dataset.src; });
    flyout.classList.add("open");
    flyoutBody.scrollTop = 0; flyoutBody.scrollLeft = 0;
    (g.tabs ? flyout.querySelector('[role="tab"][aria-selected="true"]') : [...flyout.querySelectorAll('.tool-btn')].find(button => button.style.display !== 'none'))?.focus({ preventScroll: true });
  }

  // Keep the group of the active tool marked even when the flyout is closed.
  function markGroup(toolId) {
    for (const [id, g] of Object.entries(groupEls)) {
      const has = groups.find((x) => x.id === id)?.tools.includes(toolId);
      g.header.classList.toggle("active", !!has);
    }
    toolBtns.bulldoze?.classList.toggle("active", toolId === "bulldoze");
  }


  // Overlay section (pinned at bottom of dock)
  const overlaySection = el("div");
  overlaySection.id = "overlay-section";
  const overlayLbl = el("div", "overlay-section-label", "See your city differently");
  overlaySection.appendChild(overlayLbl);
  const overlayGrid = el("div", "overlay-grid");
  overlaySection.appendChild(overlayGrid);
  consoleContext.appendChild(overlaySection);

  [
    { id: "none",      label: "City view" },
    { id: "power",     label: "Power" },
    { id: "water",     label: "Water" },
    { id: "landvalue", label: "Land value" },
    { id: "aura",      label: "Aura" },
    { id: "pollution", label: "Pollution" },
    { id: "crime",     label: "Crime" },
    { id: "traffic",   label: "Traffic" },
    { id: "police",    label: "Police" },
    { id: "fire",      label: "Fire" },
    { id: "health",    label: "Health" },
    { id: "education", label: "Education" },
    { id: "transit",   label: "Transit" },
  ].forEach(({ id, label }) => {
    const b = el("button", id === "none" ? "overlay-btn active" : "overlay-btn", label);
    b.dataset.overlay = id;
    b.setAttribute('aria-pressed', String(id === 'none'));
    b.setAttribute("aria-label", `${label} overlay`);
    b.addEventListener("click", () => actions.setOverlay(id));
    overlayGrid.appendChild(b);
  });

  // ── Bottom bar: hint, news ticker, zoom ───────────────────────────────────
  const bottomBar = el("div");
  bottomBar.id = "bottom-bar";
  buildConsole.appendChild(bottomBar);

  const newsWrap = el("div");
  newsWrap.id = "news-wrap";

  const hintLine = el("div");
  hintLine.id = "hint-line";
  hintLine.textContent = "Click a tile to inspect · select a tool to build";
  newsWrap.appendChild(hintLine);

  const newsTickerWrap = el("div");
  newsTickerWrap.id = "news-ticker-wrap";
  newsTickerWrap.appendChild(el("span", "news-label", "NEWS"));
  const newsScroll = el("div", "news-scroll");
  const newsTicker = el("button");
  newsTicker.id = "news-ticker";
  newsTicker.setAttribute('aria-label','Read city news');
  newsTicker.textContent = "Your next great neighbourhood starts with a road.";
  newsScroll.appendChild(newsTicker);
  newsTickerWrap.appendChild(newsScroll);
  newsWrap.appendChild(newsTickerWrap);
  bottomBar.appendChild(newsWrap);
  const newsDialog=el('dialog');newsDialog.setAttribute('aria-label','City news');
  let lastNotice = '';
  const newsHeader=el('div','modal-header');newsHeader.append(el('span','modal-title','City news'),btn('btn btn-icon','×','Close news',()=>newsDialog.close()));
  const newsBody=el('div','modal-body');
  function buildNews() {
    newsBody.replaceChildren();
    const list=el('ul','city-news');
    if (lastNotice && !(_lastStats?.news || []).includes(lastNotice)) list.appendChild(el('li', '', lastNotice));
    for(const message of [...(_lastStats?.news || [])].reverse()) list.appendChild(el('li','',message));
    if(!list.children.length)list.appendChild(el('li','','A new chapter is waiting to be written.'));
    newsBody.appendChild(list);
  }
  newsTicker.addEventListener('click',()=>{buildNews();newsDialog.showModal();});
  newsDialog.append(newsHeader,newsBody);app.appendChild(newsDialog);

  // Zoom buttons (right of bottom bar)
  const zoomGroup = el("div", "nav-row");
  zoomGroup.style.cssText = "margin-left:2px; flex-shrink:0";
  const zInBtn = btn("nav-btn", "+", "Zoom in [+]", () => actions.zoom?.(1));
  const zOutBtn = btn("nav-btn", "−", "Zoom out [−]", () => actions.zoom?.(-1));
  zoomGroup.classList.add('nav-zoom');
  zoomGroup.appendChild(zInBtn);
  zoomGroup.appendChild(zOutBtn);

  // ── Navigator (lower-right, above bottom bar) ──────────────────────────────
  const navigator = el("div");
  navigator.id = "navigator";
  mountNavigatorFrame(navigator);
  navigator.setAttribute('aria-label', 'City overview and camera controls');
  consoleDeck.appendChild(navigator);
  commandBar.appendChild(rciSection);
  const overlayToggle = btn('btn nav-btn map-toggle', '', 'Toggle data maps', () => {
    closeFlyout();
    if (inspPanel.classList.contains('visible')) closeInspector(false);
    const open = overlaySection.classList.toggle('open');
    overlayToggle.setAttribute('aria-expanded', String(open));
    if (open) overlayGrid.querySelector('.active')?.focus({ preventScroll: true });
  });
  overlayToggle.innerHTML = navigationArt('layers');
  overlayToggle.setAttribute('aria-expanded', 'false');
  overlayToggle.setAttribute('aria-controls', 'overlay-section');
  navigator.appendChild(overlayToggle);
  navigator.appendChild(cityMenu);
  overlaySection.appendChild(btn('panel-close', '×', 'Close data maps', () => {
    overlaySection.classList.remove('open'); overlayToggle.setAttribute('aria-expanded', 'false');
    overlayToggle.focus();
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (cityMenu.open) { cityMenu.open = false; menuSummary.focus(); }
    else if (openGroupId) closeFlyout(true);
    else if (overlaySection.classList.contains('open')) {
      overlaySection.classList.remove('open'); overlayToggle.setAttribute('aria-expanded', 'false'); overlayToggle.focus();
    }
    else if (inspPanel.classList.contains('visible')) closeInspector();
    else return;
    e.stopPropagation();
  });

  const navTop = el("div", "nav-row");
  navTop.classList.add('nav-rotation');
  for (const [direction, step] of [['left', -1], ['right', 1]]) {
    const rotate = btn('nav-btn', '', `Rotate ${direction}`, () => actions.rotate?.(step));
    rotate.innerHTML = navigationArt(direction);
    navTop.appendChild(rotate);
  }
  navigator.appendChild(navTop);
  navigator.appendChild(zoomGroup);

  // ── Build preview ──────────────────────────────────────────────────────────
  const buildPreview = el("div");
  buildPreview.id = "build-preview";
  activeTool.insertBefore(buildPreview, activeDescription);
  const bpInner = el("div", "build-preview-inner");
  const bpCount = el("span", "preview-count", "");
  const bpCost  = el("span", "preview-cost", "");
  const bpMsg   = el("span", "preview-msg", "");
  bpInner.appendChild(bpCount);
  bpInner.appendChild(bpCost);
  bpInner.appendChild(bpMsg);
  buildPreview.appendChild(bpInner);

  // ── Title screen ───────────────────────────────────────────────────────────
  const titleScreen = el("dialog");
  titleScreen.id = "title-screen";
  titleScreen.setAttribute("role", "dialog");
  titleScreen.setAttribute("aria-label", "Welcome");
  function leaveTitle() {
    titleScreen.close(); titleScreen.classList.remove('show'); app.classList.remove('welcome-open');
  }
  titleScreen.addEventListener('cancel', e => { e.preventDefault(); leaveTitle(); actions.explore?.(); });
  const titleCard = el("div", "title-card");
  const titleLogo = el("div", "title-logo");
  titleLogo.innerHTML = 'CITY BUILDER <span>3000</span>';
  titleCard.appendChild(titleLogo);
  const headline=el('h1','title-headline');
  headline.innerHTML='A little land.<br><span>Endless possibility.</span>';
  titleCard.appendChild(headline);
  titleCard.appendChild(el("p", "title-tagline", "A little land. A wild idea. A whole world waiting to come alive."));
  const titleBtns = el("div", "title-buttons");
  titleBtns.appendChild(btn("btn btn-teal title-btn", "Let’s build something  ↗", "Start a new city", () => { leaveTitle(); confirmDialog.showModal(); }));
  titleBtns.appendChild(btn("btn title-btn", "Load City", "Load a saved city", () => { leaveTitle(); buildFiles(); filesDialog.showModal(); }));
  titleBtns.appendChild(btn("btn title-btn", "Explore New Riverton", "Explore the sample town", () => { leaveTitle(); actions.explore?.(); }));
  titleCard.appendChild(titleBtns);
  titleScreen.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const first = titleBtns.firstElementChild, last = titleBtns.lastElementChild;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  titleCard.appendChild(el("p", "title-foot", "Every great city starts with a little imagination."));
  titleScreen.appendChild(titleCard);
  app.appendChild(titleScreen);

  // ── Tip box: a persistent hint with a dismiss button ──────────────────────
  const tipBox = el("div");
  tipBox.id = "tip-box";
  tipBox.setAttribute("role", "note");
  const tipText = el("span", "tip-text", "");
  tipBox.appendChild(tipText);
  const tipClose = btn("btn btn-sm", "Got it", "Dismiss tip", () => tipBox.classList.remove("show"));
  tipBox.appendChild(tipClose);
  commandBar.appendChild(tipBox);

  // ── Notification ──────────────────────────────────────────────────────────
  const notif = el("div");
  notif.id = "notif";
  notif.setAttribute("role", "status");
  bottomBar.appendChild(notif);
  let notifTimer = null;
  function showNotice(message) {
    lastNotice = message;
    notif.textContent = message;
    notif.classList.add("show");
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => notif.classList.remove("show"), 3600);
  }

  // ── Budget dialog ──────────────────────────────────────────────────────────
  const budgetDialog = document.createElement("dialog");
  budgetDialog.className = 'budget-dialog';
  budgetDialog.setAttribute("aria-label", "Budget");
  app.appendChild(budgetDialog);

  const budHdr = el("div", "modal-header");
  budHdr.appendChild(el("span", "modal-title", "Budget & Finance"));
  budHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => budgetDialog.close()));
  budgetDialog.appendChild(budHdr);

  const budBody = el("div", "modal-body");
  budgetDialog.appendChild(budBody);

  // Tax sliders
  const taxSection = el("div", "modal-section");
  taxSection.appendChild(el("div", "modal-section-title", "Tax Rates"));

  // Track slider elements to avoid overwriting focused ones
  const taxSliders = {};
  const taxVals = {};

  function addTaxSlider(parent, key, label, cls) {
    const row = el("div", "slider-row");
    const lbl = el("span", `slider-label${cls ? " " + cls : ""}`, label);
    row.appendChild(lbl);
    const s = document.createElement("input");
    s.type = "range";
    s.className = "chrome-slider";
    s.min = "0"; s.max = "20"; s.step = "1"; s.value = "7";
    s.setAttribute("aria-label", `${label} tax rate`);
    row.appendChild(s);
    const v = el("span", "slider-val", "7%");
    row.appendChild(v);
    parent.appendChild(row);
    s.addEventListener("input", () => {
      v.textContent = `${s.value}%`;
      actions.setPolicy?.(`tax.${key}`, Number(s.value));
      // backward compat
      if (!actions.setPolicy && key === "residential") actions.setTax?.(Number(s.value));
    });
    taxSliders[key] = s;
    taxVals[key] = v;
  }

  addTaxSlider(taxSection, "residential", "Residential", "r");
  addTaxSlider(taxSection, "commercial", "Commercial", "c");
  addTaxSlider(taxSection, "industrial", "Industrial", "i");
  budBody.appendChild(taxSection);

  // Funding sliders
  const fundSection = el("div", "modal-section");
  fundSection.appendChild(el("div", "modal-section-title", "Service Funding"));

  const fundSliders = {};
  const fundVals = {};

  function addFundSlider(parent, key, label) {
    const row = el("div", "slider-row");
    row.appendChild(el("span", "slider-label", label));
    const s = document.createElement("input");
    s.type = "range";
    s.className = "chrome-slider";
    s.min = "0"; s.max = "120"; s.step = "5"; s.value = "100";
    s.setAttribute("aria-label", `${label} funding`);
    row.appendChild(s);
    const v = el("span", "slider-val", "100%");
    row.appendChild(v);
    parent.appendChild(row);
    s.addEventListener("input", () => {
      v.textContent = `${s.value}%`;
      actions.setPolicy?.(`funding.${key}`, Number(s.value));
    });
    fundSliders[key] = s;
    fundVals[key] = v;
  }

  FUNDED_DEPARTMENTS.forEach((k) =>
    addFundSlider(fundSection, k, k.charAt(0).toUpperCase() + k.slice(1)),
  );
  budBody.appendChild(fundSection);

  // Department breakdown
  const deptSection = el("div", "modal-section");
  deptSection.appendChild(el("div", "modal-section-title", "Monthly Ledger"));
  const deptGrid = el("div", "stat-grid");
  const deptItems = {};
  [
    ["income.residential", "Residential tax"], ["income.commercial", "Commercial tax"], ["income.industrial", "Industrial tax"], ["income.ordinances", "Ordinance income"], ["income.deals", "Business deals"],
    ["expenses.police", "Police"], ["expenses.fire", "Fire"], ["expenses.health", "Health"], ["expenses.education", "Education"],
    ["expenses.road", "Roads"], ["expenses.transit", "Mass transit"], ["expenses.utilities", "Utilities"], ["expenses.sanitation", "Sanitation"], ["expenses.parks", "Parks"],
    ["expenses.ordinances", "Ordinance costs"], ["expenses.loans", "Loan payments"],
    ["income.neighbors", "Neighbor sales"], ["expenses.neighbors", "Neighbor purchases"],
  ].forEach(([k, label]) => {
    const item = el("div", "stat-item");
    item.appendChild(el("span", "stat-item-label", label));
    const v = el("span", "stat-item-val", "--");
    item.appendChild(v);
    deptGrid.appendChild(item);
    deptItems[k] = v;
  });
  deptSection.appendChild(deptGrid);
  budBody.appendChild(deptSection);

  // Annual figures stay available when the player opens Budget.
  const yearSection = el("div", "modal-section");
  const yearTitle = el("div", "modal-section-title", "Last Year");
  yearSection.appendChild(yearTitle);
  const yearGrid = el("div", "stat-grid");
  const yearItems = {};
  [["income", "Income"], ["expenses", "Expenses"], ["net", "Net"], ["growth", "Population change"]].forEach(([k, label]) => {
    const item = el("div", "stat-item");
    item.appendChild(el("span", "stat-item-label", label));
    const v = el("span", "stat-item-val", "--");
    item.appendChild(v);
    yearGrid.appendChild(item);
    yearItems[k] = v;
  });
  yearSection.appendChild(yearGrid);
  budBody.appendChild(yearSection);

  // Budget summary
  const budSummary = el("div", "modal-section");
  budSummary.classList.add('budget-summary');
  budSummary.appendChild(el("div", "modal-section-title", "Finances"));
  const budGrid = el("div", "stat-grid");
  const budItems = {};
  [
    ["income", "Income"],
    ["expenses", "Expenses"],
    ["balance", "Balance"],
    ["debt", "Debt"],
    ["loanPayment", "Loan Payment"],
  ].forEach(([k, label]) => {
    const item = el("div", "stat-item");
    item.appendChild(el("span", "stat-item-label", label));
    const v = el("span", "stat-item-val", "--");
    item.appendChild(v);
    budGrid.appendChild(item);
    budItems[k] = v;
  });
  budSummary.appendChild(budGrid);

  // Loans: "available in 5000 Simoleon increments, up to 25K per loan",
  // ten years at a time, and no paying one off early.
  const loanRow = el("div", "slider-row");
  loanRow.classList.add('button-row');
  loanRow.style.marginTop = "8px";
  for (let amount = LOAN_STEP; amount <= LOAN_MAX; amount += LOAN_STEP) {
    const years = LOAN_YEARS, yearly = Math.round(amount * 1.5 / years);
    loanRow.appendChild(btn("btn btn-sm", `$${amount / 1000}K`,
      `Borrow $${amount.toLocaleString()}: $${yearly.toLocaleString()} a year for ${years} years`, () => {
        actions.setPolicy?.("loan", amount);
        budgetDialog.close();
      }));
  }
  const loanNote = el("div");
  loanNote.style.cssText = "font-size:.8rem;color:var(--text-dim);margin-top:4px";
  loanNote.textContent = `Ten years of annual payments, ${MAX_LOANS} loans at a time. A loan cannot be paid off early.`;
  budSummary.appendChild(loanRow);
  loanRow.before(el('div', 'loan-heading', 'Fund your next project'));
  budSummary.appendChild(loanNote);
  budBody.appendChild(budSummary);

  // Ordinances
  const ordinanceSection = el("div", "modal-section");
  ordinanceSection.appendChild(el("div", "modal-section-title", "Ordinances"));
  const ordinanceToggles = {};
  Object.entries(ORDINANCES).forEach(([key, { label, description }]) => {
    const row = el("div", "ordinance-row");
    const lbl = el("span", "ordinance-label", label);
    lbl.title = description;
    row.appendChild(lbl);
    const tb = btn("toggle-btn", "OFF", `Toggle ${label}`, () => {
      const on = tb.classList.toggle("on");
      tb.textContent = on ? "ON" : "OFF";
      actions.setPolicy?.(`ordinance.${key}`, on);
    });
    row.appendChild(tb);
    ordinanceSection.appendChild(row);
    ordinanceToggles[key] = tb;
  });
  budBody.appendChild(ordinanceSection);

  // Neighbor deals
  const neighborSection = el("div", "modal-section");
  neighborSection.appendChild(el("div", "modal-section-title", "Neighbor Deals"));
  const neighborHint = el("p");
  neighborHint.style.cssText = "font-size:.85rem;color:var(--text-dim);line-height:1.5;margin:0 0 6px";
  neighborHint.textContent = "Run transport, a power line or a pipe to the map edge and accept its county connection fee. Click an unconnected endpoint with its matching tool to reconsider. Transport connections bring trade; utility connections enable power and water deals. Once one is up, a neighboring mayor will call on you with terms whenever your city has a surplus or a shortfall — deals are signed in the Petition window, not here.";
  neighborSection.appendChild(neighborHint);
  const neighborList = el("div");
  neighborSection.appendChild(neighborList);
  budBody.appendChild(neighborSection);
  let neighborKey = "";
  function buildNeighbors(stats) {
    const key = JSON.stringify([stats.neighbors, stats.deals]);
    if (key === neighborKey) return;
    neighborKey = key;
    neighborList.innerHTML = "";
    const resources = { power: "power", water: "water", garbage: "garbage" };
    for (const n of stats.neighbors || []) {
      const row = el("div", "neighbor-row");
      const links = [n.road ? "road" : null, n.rail ? "rail" : null, n.power ? "power line" : null, n.water ? "pipe" : null].filter(Boolean);
      row.appendChild(el("div", "neighbor-name", n.name + (links.length ? ` — connected by ${links.join(", ")}` : " — not connected")));
      const acts = el("div", "neighbor-actions");
      for (const r of Object.keys(resources)) {
        const active = stats.deals?.[r];
        if (active && active.side === n.side) {
          const earns = (active.kind === "sell") !== (r === "garbage");
          const unit = r === "garbage" ? "tons" : "units";
          const tag = el("span", "neighbor-active",
            `${active.kind === "buy" ? "Buying" : "Selling"} ${r}: ${earns ? "+" : "−"}$${active.monthly}/mo` +
            ` (${active.traded.toLocaleString()} ${unit})${active.met === false ? " — cannot deliver" : ""}`);
          acts.appendChild(tag);
          acts.appendChild(btn("btn btn-sm btn-danger", "Cancel", `Cancel ${r} deal — penalty $${active.penalty.toLocaleString()}`, () => actions.setPolicy?.("cancelDeal", r)));
          continue;
        }
        if (!n.deals?.[r] || active) continue;
        // The mayor does not go shopping: a neighbour with a use for the
        // city's surplus, or a shortfall to cover, comes to the door.
        acts.appendChild(el("span", "neighbor-open", `${r}: open to a deal`));
      }
      if (acts.children.length) row.appendChild(acts);
      neighborList.appendChild(row);
    }
  }

  const budgetTabs = el('div', 'budget-tabs');
  budgetTabs.setAttribute('role', 'tablist');
  budgetTabs.setAttribute('aria-label', 'Budget sections');
  budgetDialog.insertBefore(budgetTabs, budBody);
  const budgetPages = [
    ['Overview', [budSummary, yearSection]],
    ['Taxes & services', [taxSection, fundSection]],
    ['Ledger', [deptSection]],
    ['Policies', [ordinanceSection]],
    ['Neighbors', [neighborSection]],
  ].map(([label, sections], index) => {
    const tab = btn('btn budget-tab', label, null, () => selectBudgetPage(index));
    tab.id = `budget-tab-${index}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `budget-page-${index}`);
    const panel = el('div', 'budget-page');
    panel.id = `budget-page-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    panel.append(...sections);
    budgetTabs.appendChild(tab); budBody.appendChild(panel);
    tab.addEventListener('keydown', e => {
      const next = e.key === 'ArrowRight' ? (index + 1) % 5 : e.key === 'ArrowLeft' ? (index + 4) % 5 : e.key === 'Home' ? 0 : e.key === 'End' ? 4 : null;
      if (next == null) return;
      e.preventDefault(); e.stopPropagation(); selectBudgetPage(next); budgetPages[next].tab.focus();
    });
    return { tab, panel };
  });
  function selectBudgetPage(index) {
    budgetPages.forEach(({ tab, panel }, i) => {
      tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; panel.hidden = i !== index;
    });
    budBody.scrollTop = 0;
  }
  selectBudgetPage(0);

  const budFooter = el("div", "modal-footer");
  budFooter.appendChild(btn("btn btn-teal", "Close", null, () => budgetDialog.close()));
  budgetDialog.appendChild(budFooter);

  budgetDialog.addEventListener("click", (e) => {
    if (e.target === budgetDialog) budgetDialog.close();
  });

  // ── City Report dialog ─────────────────────────────────────────────────────
  const reportDialog = document.createElement("dialog");
  reportDialog.setAttribute("aria-label", "City Report");
  app.appendChild(reportDialog);

  const repHdr = el("div", "modal-header");
  repHdr.appendChild(el("span", "modal-title", "City Report"));
  repHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => reportDialog.close()));
  reportDialog.appendChild(repHdr);

  const repBody = el("div", "modal-body");
  reportDialog.appendChild(repBody);

  const repGraphWrap = el("details", "modal-section city-history");
  repGraphWrap.appendChild(el("summary", "modal-section-title", "Watch your city change"));
  const repGraphEl = el("div", "graph-grid");
  repGraphWrap.appendChild(repGraphEl);

  const repStatsSection = el("div", "modal-section");
  repStatsSection.appendChild(el("div", "modal-section-title", "The pulse of the place"));
  const repStatGrid = el("div", "city-signal-grid");
  const repStats = {};
  [
    'population','jobs','unemployment','happiness','lifeExpectancy','eq',
    'workforceShare','pollution','crime','traffic','garbage','waterPollution','landValue',
  ].forEach(k => {
    const item = el("div", "city-signal-card");
    repStatGrid.appendChild(item);
    repStats[k] = item;
  });
  repStatsSection.appendChild(repStatGrid);
  repBody.appendChild(repStatsSection);
  repBody.appendChild(repGraphWrap);

  const repFooter = el("div", "modal-footer");
  repFooter.appendChild(btn("btn btn-teal", "Close", null, () => reportDialog.close()));
  reportDialog.appendChild(repFooter);

  reportDialog.addEventListener("click", (e) => {
    if (e.target === reportDialog) reportDialog.close();
  });

  let _lastStats = null;
  let _selectedTool = "inspect";
  let _selectedDensity = 1;

  // The tool hint. The fire crew line carries a live count, because there are
  // only so many trucks: one per station, plus the volunteers.
  function writeHint() {
    const id = _selectedTool;
    const tool = TOOLS.find((t) => t.id === id);
    if (!tool) return;
    const b = BUILDINGS[id];
    const cost = ZONE_TYPES.has(id) ? ZONE_COST[id][_selectedDensity] : tool.cost;
    const gesture = PATH_TOOLS.has(id) || b?.path ? 'Drag to draw a route.' : RECT_TOOLS.has(id) || b?.rect ? 'Drag to mark an area.' : 'Click to place.';
    activeTitle.textContent = `${tool.label} · ${cost ? fmtMoney(cost) : 'Free'}${PATH_TOOLS.has(id) || RECT_TOOLS.has(id) || b?.path || b?.rect ? '/tile' : ''}`;
    activeDescription.textContent = `${gesture}${b?.w > 1 && !b.path && !b.rect ? ` Needs a clear ${b.w}×${b.h} site.` : ''} Esc to cancel.`;
    const size = b && b.w > 1 ? ` (${b.w}×${b.h})` : "";
    const crews = _lastStats?.crews, units = _lastStats?.units;
    hintLine.textContent = id === "inspect"
      ? "Click a tile to inspect it"
      : id === "dispatch"
      ? `Fire Crew — ${fmtMoney(tool.cost)} — click a fire${crews ? ` — ${crews.free} of ${crews.total} crews free this month` : ""}`
      : id === "patrol"
      ? `Police Unit — ${fmtMoney(tool.cost)} — click a riot${units ? ` — ${units.free} of ${units.total} units free this month` : ""}`
      : `${tool.label}${size} · ${cost > 0 ? fmtMoney(cost) : "Free"} · ${gesture}`;
  }

  function buildReport() {
    const s = _lastStats;
    if (!s) return;
    const history = s.history || [];
    repGraphEl.innerHTML = history.length >= 2
      ? REPORT_GRAPHS.map(([key, label, color, fmt]) => `<div class="graph-card"><div class="graph-title">${label}</div>${buildHistoryGraph(history, key, color, fmt)}</div>`).join("")
      : "<p style='color:var(--text-dim);font-size:.85rem'>Not enough history yet. Run the simulation for a couple of months.</p>";

    Object.entries(repStats).forEach(([key, card]) => {
      if (key==='population' || key==='jobs') {
        card.replaceChildren(el('span','signal-label',key==='population'?'People call this home':'Places to work'),el('strong','signal-total',fmtPop(s[key])));
      } else renderSignal(card,key,s[key]);
    });
  }

  // ── Advisors dialog ────────────────────────────────────────────────────────
  const advisorDialog = document.createElement("dialog");
  advisorDialog.setAttribute("aria-label", "Advisors");
  app.appendChild(advisorDialog);

  const advHdr = el("div", "modal-header");
  advHdr.appendChild(el("span", "modal-title", "Advisors"));
  advHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => advisorDialog.close()));
  advisorDialog.appendChild(advHdr);

  const advBody = el("div", "modal-body");
  advisorDialog.appendChild(advBody);

  const advFooter = el("div", "modal-footer");
  advFooter.appendChild(btn("btn btn-teal", "Close", null, () => advisorDialog.close()));
  advisorDialog.appendChild(advFooter);

  advisorDialog.addEventListener("click", (e) => {
    if (e.target === advisorDialog) advisorDialog.close();
  });

  function buildAdvisors() {
    advBody.innerHTML = "";
    const advisors = _lastStats?.advisors;
    if (!advisors?.length) {
      const def = [
        { name: "Urban Planner", role: "Planner", mood: "good", message: "Build roads first, then zone residential areas nearby." },
        { name: "Finance Chief", role: "Finance", mood: "good", message: "Keep an eye on your budget. Tax income should exceed expenses." },
        { name: "Public Works", role: "Utilities", mood: "warning", message: "Add power plants and water towers to service all zones." },
      ];
      def.forEach((a) => renderAdvisor(advBody, a));
    } else {
      advisors.forEach((a) => renderAdvisor(advBody, a));
    }
  }

  // A small procedural portrait per advisor: skin, hair, glasses and a mood.
  function portrait(name, mood) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const skin = ["#e8c9a6", "#d4a57c", "#b87d55", "#8d5a3b", "#f0d7bd", "#6b4630"][h % 6];
    const hair = ["#2b1d14", "#5a3a22", "#a86a2a", "#d9c28a", "#3a3a3a", "#8b8b8b", "#b0402a"][(h >> 3) % 7];
    const shirt = ["#3a6fa0", "#7a4f8a", "#3f7a5c", "#a05a3a", "#4a4a5a"][(h >> 6) % 5];
    const glasses = (h >> 9) % 3 === 0;
    const long = (h >> 11) % 2 === 0;
    const bg = mood === "bad" ? "#5a2a2a" : mood === "warning" ? "#5a4a1a" : "#1e4a40";
    const mouth = mood === "bad" ? "M16 27 q4 -2 8 0" : mood === "warning" ? "M16 26 h8" : "M16 25 q4 3 8 0";
    return `<svg viewBox="0 0 40 40" width="44" height="44" aria-hidden="true">
      <rect width="40" height="40" rx="4" fill="${bg}"/>
      <path d="M8 40 v-6 a12 8 0 0 1 24 0 v6 z" fill="${shirt}"/>
      ${long ? `<ellipse cx="20" cy="20" rx="11" ry="13" fill="${hair}"/>` : ""}
      <ellipse cx="20" cy="18" rx="8.5" ry="10" fill="${skin}"/>
      <path d="M11.5 15 q8.5 -11 17 0 q-2 -4 -8.5 -5 q-6.5 1 -8.5 5z" fill="${hair}"/>
      <circle cx="16.5" cy="18" r="1.1" fill="#222"/><circle cx="23.5" cy="18" r="1.1" fill="#222"/>
      ${glasses ? `<circle cx="16.5" cy="18" r="3" fill="none" stroke="#333" stroke-width=".8"/><circle cx="23.5" cy="18" r="3" fill="none" stroke="#333" stroke-width=".8"/><path d="M19.5 18 h1" stroke="#333" stroke-width=".8"/>` : ""}
      <path d="${mouth}" fill="none" stroke="#5a2a20" stroke-width="1.1" stroke-linecap="round"/>
    </svg>`;
  }

  function renderAdvisor(parent, { name, role, mood, message }) {
    const card = el("div", "advisor-card");
    const face = el("div", "advisor-portrait");
    face.innerHTML = portrait(name, mood);
    card.appendChild(face);
    const info = el("div");
    const nameRow = el("div", "advisor-name", name + (role ? ` — ${role}` : ""));
    nameRow.prepend(el("span", `advisor-mood ${mood || "good"}`));
    info.appendChild(nameRow);
    info.appendChild(el("div", "advisor-msg", message));
    card.appendChild(info);
    parent.appendChild(card);
  }

  // ── Disasters dialog ───────────────────────────────────────────────────────
  const disasterDialog = document.createElement("dialog");
  disasterDialog.setAttribute("aria-label", "Disasters");
  app.appendChild(disasterDialog);

  const disHdr = el("div", "modal-header");
  disHdr.appendChild(el("span", "modal-title", "Disasters"));
  disHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => disasterDialog.close()));
  disasterDialog.appendChild(disHdr);

  const disBody = el("div", "modal-body");
  const disMsg = el("p");
  disMsg.style.cssText = "font-size:.85rem;color:var(--text-dim);line-height:1.55";
  disMsg.textContent = "Trigger a disaster on your city. Funded fire stations contain fires; damaged roads cut off neighborhoods.";
  disBody.appendChild(disMsg);
  const disRow = el("div", "slider-row");
  disRow.classList.add('button-row');
  disRow.style.marginTop = "10px";
  Object.entries(DISASTERS).map(([id, d]) => ({ id, label: d.label, description: d.description })).forEach(({ id, label, description }) => {
    const b = btn("btn btn-sm btn-danger", label, `Start ${label.toLowerCase()}`, () => {
      disasterDialog.close();
      actions.setDisaster?.(id);
    });
    b.dataset.disaster = id;
    disRow.appendChild(b);
  });
  disBody.appendChild(disRow);

  // "If you can get your Sims off the streets and inside before a disaster
  // strikes, the damage from the disaster will be much less... you should not
  // abuse the privilege."
  disBody.appendChild(el("div", "modal-section-title", "Early Warning Siren"));
  const sirenMsg = el("p");
  sirenMsg.style.cssText = "font-size:.85rem;color:var(--text-dim);line-height:1.55";
  disBody.appendChild(sirenMsg);
  const sirenBtn = btn("btn btn-sm", "Sound the siren", "Warn the city of imminent danger", () => {
    actions.setPolicy?.("siren", true);
    disasterDialog.close();
  });
  disBody.appendChild(sirenBtn);
  const refreshSiren = (s) => {
    const siren = s?.siren;
    if (!siren) return;
    const trust = siren.trust >= .75 ? 'Most residents' : siren.trust >= .4 ? 'Some residents' : 'Few residents';
    sirenMsg.textContent = siren.sounding
      ? `The siren is sounding. ${trust} are taking cover.`
      : `${trust} would heed a warning. Shelter protects them; false alarms cost their trust.`;
    sirenBtn.disabled = !!siren.sounding;
  };
  disasterDialog.appendChild(disBody);

  const disFooter = el("div", "modal-footer");
  disFooter.appendChild(btn("btn", "Cancel", null, () => disasterDialog.close()));
  disasterDialog.appendChild(disFooter);

  disasterDialog.addEventListener("click", (e) => {
    if (e.target === disasterDialog) disasterDialog.close();
  });

  // ── Files dialog: three save slots, export and import ──────────────────────
  const filesDialog = document.createElement("dialog");
  filesDialog.setAttribute("aria-label", "Files");
  app.appendChild(filesDialog);
  const filHdr = el("div", "modal-header");
  filHdr.appendChild(el("span", "modal-title", "Save Slots & Files"));
  filHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => filesDialog.close()));
  filesDialog.appendChild(filHdr);
  const filBody = el("div", "modal-body");
  filesDialog.appendChild(filBody);
  const slotList = el("div");
  filBody.appendChild(slotList);
  const fileRow = el("div", "slider-row");
  fileRow.style.marginTop = "10px";
  fileRow.appendChild(btn("btn btn-sm", "Export to file", "Export city to a file", () => actions.exportSave?.()));
  const importInput = document.createElement("input");
  importInput.type = "file"; importInput.accept = ".json,application/json"; importInput.style.display = "none";
  importInput.setAttribute("aria-label", "Import city file");
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    importInput.value = "";
    filesDialog.close();
    actions.importSave?.(text);
  });
  fileRow.appendChild(btn("btn btn-sm", "Import from file", "Import city from a file", () => importInput.click()));
  fileRow.appendChild(importInput);
  filBody.appendChild(fileRow);
  const filFooter = el("div", "modal-footer");
  filFooter.appendChild(btn("btn btn-teal", "Close", null, () => filesDialog.close()));
  filesDialog.appendChild(filFooter);
  filesDialog.addEventListener("click", (e) => { if (e.target === filesDialog) filesDialog.close(); });
  function buildFiles() {
    slotList.innerHTML = "";
    const slots = actions.listSaves?.() || [];
    for (const s of slots) {
      const row = el("div", "save-slot");
      const label = s.label || `Slot ${s.slot}`;
      const info = el("div", "save-slot-info", s.empty ? `${label}: empty` : `${label}: ${s.name}`);
      if (!s.empty) { const small = document.createElement("small"); small.textContent = `${s.date} · ${fmtPop(s.population)} residents · ${fmtMoney(s.money)}`; info.appendChild(small); }
      row.appendChild(info);
      if (s.slot > 0) row.appendChild(btn("btn btn-sm", "Save", `Save to slot ${s.slot}`, () => { actions.save?.(s.slot); buildFiles(); }));
      const load = btn("btn btn-sm btn-teal", "Load", s.slot === 0 ? "Load autosave" : `Load slot ${s.slot}`, () => { filesDialog.close(); actions.load?.(s.slot); });
      if (s.empty) load.disabled = true;
      row.appendChild(load);
      slotList.appendChild(row);
    }
  }

  // ── Petition dialog ────────────────────────────────────────────────────────
  const petitionDialog = document.createElement("dialog");
  petitionDialog.setAttribute("aria-label", "Petition");
  app.appendChild(petitionDialog);
  const petHdr = el("div", "modal-header");
  const petTitle = el("span", "modal-title", "Petition");
  petHdr.appendChild(petTitle);
  petitionDialog.appendChild(petHdr);
  const petBody = el("div", "modal-body");
  const petText = el("p");
  petText.style.cssText = "font-size:.9rem;color:var(--text);line-height:1.6";
  petBody.appendChild(petText);
  petitionDialog.appendChild(petBody);
  const petFooter = el("div", "modal-footer");
  const petDecline = btn("btn", "Decline", "Decline petition", () => { petitionDialog.close(); actions.setPolicy?.("petition", { id: petitionDialog.dataset.id, accept: false }); });
  const petAccept = btn("btn btn-teal", "Accept", "Accept petition", () => { petitionDialog.close(); actions.setPolicy?.("petition", { id: petitionDialog.dataset.id, accept: true }); });
  const petLater = btn("btn", "Decide later", "Decide later", () => petitionDialog.close());
  petFooter.appendChild(petLater);
  petFooter.appendChild(petDecline);
  petFooter.appendChild(petAccept);
  petitionDialog.appendChild(petFooter);
  let shownPetition = "";
  const petitionBtn = btn('management-card', '', 'Open petition', () => { if (petitionDialog.dataset.id) { hub.dialog.close(); petitionDialog.showModal(); } });
  petitionBtn.innerHTML = `<span class="management-art">${categoryArt('special')}</span><span><strong>Petitions & offers</strong><small>No offers waiting. Mayors and businesses will contact you here.</small></span>`;
  petitionBtn.disabled = true;
  hub.grid.appendChild(petitionBtn);

  // ── Help dialog ────────────────────────────────────────────────────────────
  const helpDialog = document.createElement("dialog");
  helpDialog.setAttribute("aria-label", "Help");
  app.appendChild(helpDialog);

  const hlpHdr = el("div", "modal-header");
  hlpHdr.appendChild(el("span", "modal-title", "Controls & Help"));
  hlpHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => helpDialog.close()));
  helpDialog.appendChild(hlpHdr);

  const hlpBody = el("div", "modal-body");
  helpDialog.appendChild(hlpBody);

  function helpSection(title, rows) {
    const sec = el("div", "help-section");
    sec.appendChild(el("div", "help-section-title", title));
    const grid = el("div", "help-grid");
    rows.forEach(([key, desc]) => {
      grid.appendChild(el("kbd", "help-key", key));
      grid.appendChild(el("span", "help-desc", desc));
    });
    sec.appendChild(grid);
    hlpBody.appendChild(sec);
  }

  function helpText(title, paragraphs) {
    const sec = el("div", "help-section");
    sec.appendChild(el("div", "help-section-title", title));
    for (const p of paragraphs) { const para = el("p", "help-para", p); sec.appendChild(para); }
    hlpBody.appendChild(sec);
  }
  helpText("How to play", [
    "Zone land (residential, commercial, industrial) next to roads. Lots develop when they have road access within three tiles, power, and for medium or high density, water. Demand (the R C I bars) decides how fast they grow; jobs attract residents, residents attract shops, and industry follows the workforce.",
    "Power flows from plants through power lines, zoned tiles and buildings, and hops across a single road. Water comes from pumps (best next to water) or towers through pipes; every pipe serves six tiles around it. Plants and pumps have limited capacity.",
    "Police, fire, health and education coverage depends on distance and department funding in the Budget. Garbage needs landfills, an incinerator or a recycling center. Parks, trees and water raise land value; industry, pollution, crime and traffic lower it.",
    "Airports and seaports are zones too. Draw at least 3x5 for an airport (from 1930) or 2x6 for a seaport, give the block power, water and a road, and the Sims build the terminal once the city's commerce and industry need outside trade. A seaport only works on a shoreline, and pays best on a seacoast.",
    "Roads, rails, power lines and pipes that reach the map edge connect you to a neighbor: trade lifts demand, and lines or pipes let you buy or sell power and water. A seaport counts as a connection to every neighbor.",
    "Population milestones unlock rewards such as the Mayor's House and City Hall. Petitioners bring money-making business deals with strings attached, and neighboring mayors bring power, water and garbage contracts on terms that change from offer to offer. Turn one down and the petitioner may never come back. Open Budget to check yearly figures. January autosaves while play continues.",
  ]);
  helpSection("Navigation", [
    ["Minimap", "Click or drag to travel. The layers button opens data maps."],
    ["WASD / ↑↓←→", "Pan the map"],
    ["Scroll", "Zoom in / out"],
    ["Right drag", "Pan the map"],
    ["[ / ]", "Rotate the view"],
    ["H", "Center on the city"],
    ["+ / −", "Zoom in / out"],
  ]);
  helpSection("Building", [
    ["Click", "Place a building (large ones center on the cursor)"],
    ["Drag", "Zone an area or draw a road, rail, line or pipe (release to commit)"],
    ["Esc", "Cancel a drag, then switch to the query tool"],
    ["Ctrl+Z", "Undo the last construction"],
    ["Bulldoze", "Clears a building first, the zone second"],
  ]);
  helpSection("Speed", [
    ["0", "Pause"],
    ["1", "Normal speed"],
    ["2", "Fast"],
    ["3", "Very fast"],
  ]);
  const toolRows = TOOLS.filter((t) => t.shortcut).map((t) => [
    t.shortcut.toUpperCase(),
    `${t.label}${t.cost > 0 ? ` (${fmtMoney(t.cost)})` : ""}`,
  ]);
  if (toolRows.length) helpSection("Tool Shortcuts", toolRows);

  const hlpFooter = el("div", "modal-footer");
  hlpFooter.appendChild(btn("btn btn-teal", "Got it", null, () => helpDialog.close()));
  helpDialog.appendChild(hlpFooter);

  helpDialog.addEventListener("click", (e) => {
    if (e.target === helpDialog) helpDialog.close();
  });

  // ── Confirm new city dialog ────────────────────────────────────────────────
  const confirmDialog = document.createElement("dialog");
  confirmDialog.setAttribute("aria-label", "New city");
  app.appendChild(confirmDialog);

  const cfmHdr = el("div", "modal-header");
  cfmHdr.appendChild(el("span", "modal-title", "New City"));
  cfmHdr.appendChild(btn("btn btn-icon", "✕", "Close", () => confirmDialog.close()));
  confirmDialog.appendChild(cfmHdr);

  const cfmBody = el("div", "modal-body");
  const cfmMsg = el("p");
  cfmMsg.style.cssText = "font-size:.85rem;color:var(--text-dim);line-height:1.55;margin:0 0 8px";
  cfmMsg.textContent = "Starting a new city discards the current one unless you saved it.";
  cfmBody.appendChild(cfmMsg);

  const form = {};
  function formRow(label, control) {
    const row = el("div", "slider-row");
    row.appendChild(el("span", "slider-label", label));
    row.appendChild(control);
    cfmBody.appendChild(row);
    return control;
  }
  function select(name, options, value) {
    const s = document.createElement("select");
    s.className = "chrome-select";
    s.setAttribute("aria-label", name);
    for (const [v, text] of options) { const o = document.createElement("option"); o.value = v; o.textContent = text; s.appendChild(o); }
    s.value = value;
    return s;
  }
  const nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.className = "chrome-input"; nameInput.maxLength = 40; nameInput.value = "New Riverton";
  nameInput.setAttribute("aria-label", "New city name");
  form.name = formRow("City name", nameInput);
  form.layout = formRow("Terrain", select("Terrain", [["random", "Surprise me"], ["river", "River"], ["coast", "Coast"], ["lakes", "Lakes"], ["delta", "River delta"], ["plains", "Plains"]], "random"));
  form.size = formRow("Map size", select("Map size", [["64", "Small (64×64)"], ["96", "Medium (96×96)"], ["128", "Large (128×128)"]], "64"));
  form.hills = formRow("Hills", select("Hills", [["0", "Flat"], ["0.5", "Gentle"], ["1", "Rolling"], ["1.6", "Mountainous"]], "1"));
  form.money = formRow("Starting funds", select("Starting funds", [["50000", "$50,000 (easy)"], ["25000", "$25,000 (medium)"], ["10000", "$10,000 (hard)"]], "50000"));
  form.year = formRow("Start year", select("Start year", [["1900", "1900 — coal and rail"], ["1950", "1950 — oil, gas and airports"], ["2000", "2000 — everything"], ["2050", "2050"]], "2000"));
  form.start = formRow("Start with", select("Start with", [["blank", "Empty land"], ["town", "An established town"]], "blank"));
  form.scenario = formRow("Scenario", select("Scenario", [["sandbox", "Open play"], ["growth", "Grow to 20,000 in ten years"], ["boomtown", "Boomtown: 50,000 in twenty years"], ["recovery", "Rescue a failing town"], ["cleanup", "Smokestack City: clear the air"], ["aftermath", "After the quake: rebuild"]], "sandbox"));
  confirmDialog.appendChild(cfmBody);

  const cfmFooter = el("div", "modal-footer");
  cfmFooter.appendChild(btn("btn", "Cancel", null, () => confirmDialog.close()));
  cfmFooter.appendChild(btn("btn btn-teal", "Start City", "Start city", () => {
    confirmDialog.close();
    actions.newCity?.({
      name: form.name.value.trim() || "New Riverton",
      layout: form.layout.value === "random" ? undefined : form.layout.value,
      size: Number(form.size.value),
      money: Number(form.money.value),
      startYear: Number(form.year.value),
      hills: Number(form.hills.value),
      starter: form.start.value === "town",
      scenario: form.scenario.value,
    });
  }));
  confirmDialog.appendChild(cfmFooter);

  confirmDialog.addEventListener("click", (e) => {
    if (e.target === confirmDialog) confirmDialog.close();
  });

  for (const dialog of [budgetDialog, reportDialog, advisorDialog]) {
    dialog.querySelector('.modal-footer').prepend(btn('btn', '← City management', 'Back to city management', () => { dialog.close(); hub.dialog.showModal(); }));
  }

  // ── RCI helper ─────────────────────────────────────────────────────────────
  function updateRci(bar, demand) {
    bar.val.parentElement.setAttribute('aria-valuenow', String(Math.max(-100, Math.min(100, demand || 0))));
    if (demand == null) { bar.val.textContent = "--"; bar.fill.style.width = "0%"; return; }
    bar.val.textContent = demandSignal(demand);
    bar.val.parentElement.setAttribute('aria-valuetext',demandSignal(demand));
    const abs = Math.abs(demand);
    const pct = (abs / 100) * 50; // 50% = half of track = full demand
    bar.fill.className = demand >= 0 ? "rci-fill pos" : "rci-fill neg";
    bar.fill.style.width = `${pct}%`;
    bar.val.style.color = demand > 10 ? "var(--text-pos)" : demand < -10 ? "var(--text-neg)" : "var(--text-dim)";
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    update(city, stats) {
      _lastStats = stats;
      if (_selectedTool === "dispatch" || _selectedTool === "patrol") writeHint();
      refreshSiren(stats);

      // Top metrics
      mPop.textContent    = fmtPop(stats.population);
      const funds = stats.money ?? city.money;
      const mood=citySignal('happiness',stats.happiness);
      mHappy.textContent=mood.word;
      happyWrap.dataset.tone=mood.tone;
      moodTrack.firstChild.style.width=`${mood.level}%`;

      moneyDisplay.textContent = fmtMoney(funds);
      moneyDisplay.className   = "status-money" + (funds < 0 ? " neg" : "");
      dateDisplay.textContent  = stats.date || "--";

      // City name
      if (city.name && document.activeElement !== cityName) {
        cityName.value = city.name;
      }

      // Tax sliders (sync from city, only if not focused)
      if (city.taxes) {
        ["residential", "commercial", "industrial"].forEach((k) => {
          const s = taxSliders[k];
          if (s && document.activeElement !== s && city.taxes[k] != null) {
            s.value = city.taxes[k];
            taxVals[k].textContent = `${city.taxes[k]}%`;
          }
        });
      } else if (city.tax != null) {
        const s = taxSliders.residential;
        if (s && document.activeElement !== s) {
          s.value = city.tax;
          taxVals.residential.textContent = `${city.tax}%`;
        }
      }

      // Funding sliders
      if (city.funding) {
        Object.entries(city.funding).forEach(([k, v]) => {
          const s = fundSliders[k];
          if (s && document.activeElement !== s && v != null) {
            s.value = v;
            fundVals[k].textContent = `${v}%`;
          }
        });
      }

      // Neighbors
      buildNeighbors(stats);

      // Ledger
      if (stats.budget) {
        Object.entries(deptItems).forEach(([k, el]) => {
          const [group, key] = k.split(".");
          const v = stats.budget[group]?.[key];
          el.textContent = v != null ? fmtMoney(v) : "--";
        });
      }

      // Ordinance toggles
      if (city.ordinances) {
        Object.keys(ORDINANCES).forEach((k) => {
          const tb = ordinanceToggles[k];
          if (!tb) return;
          const on = !!city.ordinances[k];
          tb.classList.toggle("on", on);
          tb.textContent = on ? "ON" : "OFF";
        });
      }

      // Budget summary items
      if (budItems.income) budItems.income.textContent     = fmtMoney(stats.income);
      if (budItems.expenses) budItems.expenses.textContent = stats.expenses != null ? fmtMoney(stats.expenses) : "--";
      if (budItems.balance) {
        budItems.balance.textContent = fmtMoney(stats.balance);
        budItems.balance.className = "stat-item-val" +
          (stats.balance > 0 ? " pos" : stats.balance < 0 ? " neg" : "");
      }
      if (budItems.debt) budItems.debt.textContent     = fmtMoney(stats.debt ?? city.debt);
      if (budItems.loanPayment) budItems.loanPayment.textContent = fmtMoney(stats.loanPayment);

      // RCI demand
      const d = stats.demand;
      updateRci(rciR, d?.residential);
      updateRci(rciC, d?.commercial);
      updateRci(rciI, d?.industrial);

      // Rewards and deals: only unlocked, unbuilt specials show in the dock.
      if (stats.available) {
        for (const type of SPECIAL_TYPES) {
          const b = toolBtns[type];
          if (!b) continue;
          const show = !!stats.available[type];
          b.style.display = show ? "" : "none";
        }
      }
      // Technology: hide buildings the era has not invented yet.
      if (stats.tech) {
        for (const [type, ok] of Object.entries(stats.tech)) {
          const b = toolBtns[type];
          if (b && !SPECIAL_TYPES.includes(type)) b.style.display = ok ? "" : "none";
        }
      }

      // Petitions: announce once, pause, and keep a button while open.
      const p = stats.petition;
      if (p) {
        petitionBtn.disabled = false;
        petitionBtn.querySelector('small').textContent = p.title;
        managementButton.classList.add('has-petition');
        petitionDialog.dataset.id = p.id;
        petTitle.textContent = p.title;
        petText.textContent = p.body;
        petAccept.textContent = p.accept;
        petDecline.textContent = p.decline;
        const key = `${p.id}:${p.since}`;
        if (shownPetition !== key && !document.querySelector("dialog[open]")) {
          shownPetition = key;
          actions.setSpeed?.(0);
          petitionDialog.showModal();
        }
      } else {
        petitionBtn.disabled = true;
        petitionBtn.querySelector('small').textContent = 'No offers waiting. Mayors and businesses will contact you here.';
        managementButton.classList.remove('has-petition');
        delete petitionDialog.dataset.id;
      }

      // Annual financial figures.
      const hist = stats.history || [];
      if (hist.length >= 12) {
        const year = hist.slice(-12);
        const inc = year.reduce((s, h) => s + (h.income || 0), 0), exp = year.reduce((s, h) => s + (h.expenses || 0), 0);
        yearItems.income.textContent = fmtMoney(inc);
        yearItems.expenses.textContent = fmtMoney(exp);
        yearItems.net.textContent = fmtMoney(inc - exp);
        yearItems.net.className = "stat-item-val" + (inc - exp >= 0 ? " pos" : " neg");
        const growth = year[year.length - 1].population - year[0].population;
        yearItems.growth.textContent = (growth >= 0 ? "+" : "") + fmtPop(growth);
      }

      // News ticker
      if (Array.isArray(stats.news) && stats.news.length) {
        newsTicker.textContent = stats.news.at(-1);
        newsTicker.title = stats.news.at(-1);
      }
      if(newsDialog.open)buildNews();
    },

    notify(message) {
      showNotice(message);
    },

    tip(message) {
      if (!message) { tipBox.classList.remove("show"); return; }
      tipText.textContent = message;
      tipBox.classList.add("show");
    },

    showTitle() {
      titleScreen.classList.add("show");
      app.classList.add('welcome-open');
      titleScreen.showModal();
    },

    setTool(id) {
      closeFlyout(true);

      overlaySection.classList.remove('open'); overlayToggle.setAttribute('aria-expanded', 'false');
      // Update all tool buttons
      Object.entries(toolBtns).forEach(([tid, b]) => {
        b.classList.toggle("active", tid === id); b.setAttribute('aria-pressed', String(tid === id));
      });
      // Inspect standalone
      inspectBtn.classList.toggle("active", id === "inspect");
      inspectBtn.setAttribute('aria-pressed', String(id === 'inspect'));

      // Hint
      _selectedTool = id;
      writeHint();
      activeTool.classList.toggle('visible', id !== 'inspect');

      // Density strip visibility. Ports are zones with a single density, so
      // the strip has nothing to offer while one is selected.
      const densStrip = document.getElementById("density-strip");
      if (densStrip) {
        densStrip.classList.toggle("visible", ZONE_TYPES.has(id));
        densStrip.classList.toggle("no-density", PORT_TYPES.has(id));
      }

      // Inspector: hide when not inspecting
      if (id !== "inspect") {
        inspPanel.classList.remove("visible");
      }

      markGroup(id);
    },

    setSelection(info) {
      if (!info) {
        inspPanel.classList.remove("visible");
        return;
      }
      closeFlyout();

      overlaySection.classList.remove('open'); overlayToggle.setAttribute('aria-expanded', 'false');
      inspPanel.classList.add("visible");
      inspPortrait.classList.toggle("visible", !!info.anchor);
      if (info.anchor) lotCard.draw(info.anchor, info.night, info.rotation);
      inspTitle.textContent = info.title || "--";
      inspDesc.textContent  = (info.description || "").replace(/ \([^)]*lot, stage[^)]*\)/,'');
      inspDetails.innerHTML = "";
      inspFacts.replaceChildren();
      const place=`${info.x},${info.y}`;
      if (inspectedPlace!==place) { inspMore.open=false;inspPanel.scrollTop=0; }
      inspectedPlace=place;
      inspNotes.replaceChildren();
      const tile=info.tile;
      if (tile) {
        const services=el('div','place-services');
        for(const {label,icon,ready} of placeServices(info.anchor || tile)) {
          const badge=el('span',`service-badge ${ready?'ready':'missing'}`);
          badge.innerHTML=iconFor(icon);badge.appendChild(el('span','',`${label} ${ready?'✓':'!'}`));
          badge.setAttribute('role','img');
          badge.setAttribute('aria-label',`${label}: ${ready?'connected':'missing'}`);services.appendChild(badge);
        }
        inspDetails.appendChild(services);
        if (tile.fire || info.anchor?.abandoned) inspDetails.appendChild(el('div','place-alert',tile.fire?'On fire! Send a fire crew.':'Abandoned. Help this place come back to life.'));
      }
      if (Array.isArray(info.details)) {
        for(const detail of info.details) {
          if (/^(Land value|Pollution|Crime|Power:|ON FIRE)/.test(detail) && tile) continue;
          const score=detail.match(/^(Flammability|Traffic): (\d+)\/100/);
          if (score) { const card=el('div','city-signal-card');renderSignal(card,score[1].toLowerCase(),Number(score[2]));inspNotes.appendChild(card); }
          else {
            const note=inspectNote(detail);
            if(note.kind==='signal') {const card=el('div','city-signal-card');renderSignal(card,note.key,note.value);inspDetails.appendChild(card);}
            else if(note.kind==='urgent') inspDetails.prepend(el('div','place-alert',note.text));
            else (note.kind==='primary'?inspFacts:inspNotes).appendChild(el('div','insp-detail',note.text));
          }
        }
      }
      if(tile)for(const key of ['landValue','pollution','crime']) {
        if(key!=='landValue' && !tile[key])continue;
        const card=el('div','city-signal-card');renderSignal(card,key,tile[key]);inspDetails.appendChild(card);
      }
    },

    setOverlay(id) {
      overlayToggle.classList.toggle('active', id !== 'none');
      const label = [...overlayGrid.children].find(b => b.dataset.overlay === id)?.textContent || id;
      overlayToggle.title = id === 'none' ? 'Data maps' : `${label} overlay active`;
      overlayToggle.setAttribute('aria-description', id === 'none' ? 'City view' : `${label} overlay active`);
      overlayGrid.querySelectorAll(".overlay-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.overlay === id); b.setAttribute('aria-pressed', String(b.dataset.overlay === id));
      });
    },

    setBuildPreview({ count, cost, valid, message } = {}) {
      if (!count) {
        buildPreview.classList.remove("visible");
        return;
      }
      buildPreview.classList.add("visible");
      bpCount.textContent = `${count} ${count !== 1 ? "tiles" : "tile"}`;
      bpCost.textContent  = fmtMoney(cost);
      bpCost.className    = `preview-cost ${valid ? "valid" : "invalid"}`;
      bpMsg.textContent   = message || "";
    },

    setDensity(n) {
      _selectedDensity = n;
      document.querySelectorAll(".density-btn").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.density) === n); b.setAttribute('aria-pressed', String(Number(b.dataset.density) === n));
      });
      writeHint();
    },

    setSpeed(n) {
      clockState.textContent = ['Paused', 'Living city', 'Fast', 'Very fast'][n] || 'Paused';
      speedGroup.classList.toggle('running', n > 0);
      document.querySelectorAll("[data-speed]").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.speed) === n);
        b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === n));
      });
    },
  };
}
