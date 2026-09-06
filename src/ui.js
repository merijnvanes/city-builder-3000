import { TOOLS, BUILDINGS, ORDINANCES, DISASTERS, FUNDED_DEPARTMENTS } from "./sim.js";

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

// ── Tool group definitions ───────────────────────────────────────────────────
const GROUP_DEFS = [
  { id: "zone",      label: "Zones",     tools: ["residential", "commercial", "industrial"], hasDensity: true },
  { id: "transport", label: "Transport", tools: ["road", "rail", "bus", "railstation"] },
  { id: "power",     label: "Power",     tools: ["coal", "oil", "gas", "nuclear", "wind", "solar", "powerline"] },
  { id: "water",     label: "Water",     tools: ["waterpump", "watertower", "treatment", "pipe"] },
  { id: "civic",     label: "Civic",     tools: ["police", "fire", "hospital", "school", "college", "library", "museum"] },
  { id: "sanitation", label: "Sanitation", tools: ["landfill", "incinerator", "recycling"] },
  { id: "landscape", label: "Parks",     tools: ["park", "largepark", "zoo", "tree"] },
];

// Icons fall back to a lettered badge so every catalog entry gets a button.
function iconFor(id, label) {
  if (ICONS[id]) return ICONS[id];
  const alias = { coal: "power", oil: "power", gas: "power", nuclear: "power", wind: "power", solar: "power", waterpump: "water", watertower: "water", treatment: "water", railstation: "rail", largepark: "park", zoo: "park", tree: "park", college: "school", library: "school", museum: "school", incinerator: "landfill", recycling: "landfill" }[id];
  if (alias && ICONS[alias]) return ICONS[alias];
  const letter = (label || id).charAt(0).toUpperCase();
  return `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="14" height="14" rx="3" opacity=".35"/><text x="10" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${letter}</text></svg>`;
}

const PATH_TOOLS = new Set(["road", "rail", "powerline", "pipe"]);
const RECT_TOOLS = new Set(["residential", "commercial", "industrial", "park", "landfill", "tree", "bulldoze"]);

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
function buildHistoryGraph(history, key, color) {
  const W = 460, H = 100, PAD = 10;
  const vals = history.map((h) => h[key] ?? 0).filter((v) => !isNaN(v));
  if (!vals.length) return "";
  const mn = Math.min(...vals);
  const mx = Math.max(...vals) || 1;
  const scale = (v) => H - PAD - ((v - mn) / (mx - mn || 1)) * (H - PAD * 2);
  const pts = vals.map((v, i) => `${PAD + (i / (vals.length - 1 || 1)) * (W - PAD * 2)},${scale(v)}`).join(" ");
  return `<svg class="history-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="${PAD}" y="${H - 2}" font-size="8" fill="#7a90a8">${fmtPop(mn)}</text>
    <text x="${PAD}" y="10" font-size="8" fill="#7a90a8">${fmtPop(mx)}</text>
  </svg>`;
}

// ── mountUI ────────────────────────────────────────────────────────────────────
export function mountUI(actions) {
  const app = document.getElementById("app");
  const toolMap = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

  // Resolve groups — filter to only tools actually in TOOLS export
  const groups = GROUP_DEFS.map((g) => ({
    ...g,
    tools: g.tools.filter((id) => toolMap[id]),
  })).filter((g) => g.tools.length > 0);

  // ── Top bar ────────────────────────────────────────────────────────────────
  const topBar = el("div");
  topBar.id = "top-bar";
  app.appendChild(topBar);

  // Logo
  const logoMark = el("div");
  logoMark.id = "logo-mark";
  logoMark.innerHTML = "CITY BUILDER <span>3000</span>";
  logoMark.title = "Center view";
  logoMark.addEventListener("click", () => actions.home?.());
  topBar.appendChild(logoMark);

  const topSep1 = el("div", "top-sep");
  topBar.appendChild(topSep1);

  // City name (editable)
  const cityName = document.createElement("input");
  cityName.id = "city-name";
  cityName.type = "text";
  cityName.value = "New Riverton";
  cityName.setAttribute("aria-label", "City name");
  cityName.addEventListener("change", () => {
    actions.renameCity?.(cityName.value.trim() || "New Riverton");
  });
  topBar.appendChild(cityName);

  const topSep2 = el("div", "top-sep");
  topBar.appendChild(topSep2);

  // Top metrics strip
  const topMetrics = el("div");
  topMetrics.id = "top-metrics";
  topBar.appendChild(topMetrics);

  function topMetric(id, label) {
    const m = el("div", "top-metric");
    m.appendChild(el("span", "top-metric-label", label));
    const v = el("span", "top-metric-val");
    v.id = id;
    v.textContent = "--";
    m.appendChild(v);
    topMetrics.appendChild(m);
    return v;
  }

  const mPop   = topMetric("tm-pop", "Pop");
  const mMoney = topMetric("tm-money", "Funds");
  mMoney.classList.add("money");
  const mHappy  = topMetric("tm-happy", "Happy");
  mHappy.classList.add("happy");
  const mDate   = topMetric("tm-date", "Date");

  // Top menu buttons
  const topMenuBtns = el("div");
  topMenuBtns.id = "top-menu-btns";
  topBar.appendChild(topMenuBtns);

  const budgetDlgBtn = btn("btn", "Budget", "Open budget", () => budgetDialog.showModal());
  topMenuBtns.appendChild(budgetDlgBtn);
  const reportDlgBtn = btn("btn", "Report", "City report", () => { buildReport(); reportDialog.showModal(); });
  topMenuBtns.appendChild(reportDlgBtn);
  const advisorBtn = btn("btn", "Advisors", "Advisors", () => { buildAdvisors(); advisorDialog.showModal(); });
  topMenuBtns.appendChild(advisorBtn);
  topMenuBtns.appendChild(btn("btn", "Disasters", "Disasters", () => disasterDialog.showModal()));

  topMenuBtns.appendChild(el("div", "top-sep"));

  topMenuBtns.appendChild(btn("btn", "Save", "Save city", () => actions.save?.()));
  topMenuBtns.appendChild(btn("btn", "Load", "Load city", () => actions.load?.()));
  topMenuBtns.appendChild(btn("btn btn-danger", "New", "New city", () => confirmDialog.showModal()));

  topMenuBtns.appendChild(el("div", "top-sep"));

  topMenuBtns.appendChild(btn("btn btn-icon", "☀", "Toggle day/night", () => actions.toggleDay?.()));
  const soundBtn = btn("btn btn-icon", "♫", "Toggle soundtrack", async () => {
    const enabled = await actions.toggleSound?.();
    soundBtn.setAttribute("aria-pressed", String(!!enabled));
  });
  soundBtn.setAttribute("aria-pressed", "false");
  topMenuBtns.appendChild(soundBtn);
  topMenuBtns.appendChild(btn("btn btn-icon", "?", "Help", () => helpDialog.showModal()));

  // Mobile dock toggle
  const mobileDockBtn = btn("btn btn-icon", "☰", "Toggle tools", () => {
    const open = rightDock.classList.toggle("mobile-open");
    mobileDockBtn.setAttribute("aria-expanded", String(open));
  });
  mobileDockBtn.setAttribute("aria-expanded", "false");
  mobileDockBtn.style.cssText = "display:none";
  topMenuBtns.appendChild(mobileDockBtn);

  // ── Right dock ─────────────────────────────────────────────────────────────
  const rightDock = el("div");
  rightDock.id = "right-dock";
  app.appendChild(rightDock);

  // Top tools (inspect + undo)
  const dockTopTools = el("div");
  dockTopTools.id = "dock-top-tools";
  rightDock.appendChild(dockTopTools);

  const inspectBtn = svgBtn("btn tool-btn", "inspect", "Inspect tile [I]", () => actions.selectTool("inspect"));
  inspectBtn.dataset.tool = "inspect";
  dockTopTools.appendChild(inspectBtn);

  const undoBtn = svgBtn("btn tool-btn", "undo", "Undo [Ctrl+Z]", () => actions.undo?.());
  dockTopTools.appendChild(undoBtn);

  // Scrollable body
  const dockScroll = el("div");
  dockScroll.id = "dock-scroll";
  rightDock.appendChild(dockScroll);

  // Inspector panel (inside scroll)
  const inspPanel = el("div");
  inspPanel.id = "inspector-panel";
  inspPanel.setAttribute("aria-live", "polite");
  const inspHeaderLbl = el("div", "insp-header-label", "Inspect");
  inspPanel.appendChild(inspHeaderLbl);
  const inspTitle = el("div", "insp-title", "--");
  inspPanel.appendChild(inspTitle);
  const inspDesc = el("div", "insp-desc", "");
  inspPanel.appendChild(inspDesc);
  const inspDetails = el("div");
  inspPanel.appendChild(inspDetails);
  dockScroll.appendChild(inspPanel);

  // Tool groups
  const toolBtns = {}; // id -> button element
  const groupEls = {}; // groupId -> { header, body, el }

  groups.forEach((g) => {
    const groupEl = el("div", "tool-group");
    const header = el("div", "group-header");
    header.setAttribute("role", "button");
    header.setAttribute("aria-label", g.label);
    header.tabIndex = 0;
    header.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); header.click(); }
    });
    header.setAttribute("aria-expanded", "false");
    const arrow = el("span", "group-arrow", "▶");
    header.appendChild(arrow);
    header.appendChild(el("span", "group-label", g.label));
    groupEl.appendChild(header);

    const body = el("div", "group-body");
    const cols = g.tools.length <= 2 ? 2 : g.tools.length === 4 ? 4 : 3;
    const grid = el("div", `tool-grid${cols === 2 ? " tool-grid-2" : cols === 4 ? " tool-grid-4" : ""}`);

    g.tools.forEach((toolId) => {
      const t = toolMap[toolId];
      if (!t) return;
      const costStr = t.cost > 0 ? fmtMoney(t.cost) : "Free";
      const b = el("button", "tool-btn");
      b.dataset.tool = toolId;
      b.title = `${t.label}\n${t.description || ""}\nCost: ${costStr}${t.shortcut ? ` [${t.shortcut.toUpperCase()}]` : ""}`;
      b.setAttribute("aria-label", t.label);
      const iconWrap = el("span");
      iconWrap.innerHTML = iconFor(toolId, t.label);
      b.appendChild(iconWrap);
      b.appendChild(el("span", "tool-label", t.label));
      b.addEventListener("click", () => { actions.selectTool(toolId); expandGroup(g.id); });
      grid.appendChild(b);
      toolBtns[toolId] = b;
    });

    body.appendChild(grid);

    // Density strip for zone group
    if (g.hasDensity) {
      const densityStrip = el("div");
      densityStrip.id = "density-strip";
      const densLbl = el("div", "density-label", "Density");
      densityStrip.appendChild(densLbl);
      const densBtns = el("div", "density-btns");
      [1, 2, 3].forEach((d) => {
        const db = el("button", d === 1 ? "density-btn active" : "density-btn", `${d}★`);
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
      body.appendChild(densityStrip);
    }

    groupEl.appendChild(body);
    dockScroll.appendChild(groupEl);

    header.addEventListener("click", () => toggleGroup(g.id));
    groupEls[g.id] = { el: groupEl, header, body };
  });

  // Bulldoze standalone
  const bulldozeGroup = el("div", "tool-group");
  const bulldozeGrid = el("div", "tool-grid");
  if (toolMap["bulldoze"]) {
    const t = toolMap["bulldoze"];
    const b = el("button", "tool-btn");
    b.dataset.tool = "bulldoze";
    b.title = `Bulldoze\nDemolish tiles\nCost: ${fmtMoney(t.cost)}${t.shortcut ? ` [${t.shortcut.toUpperCase()}]` : ""}`;
    b.setAttribute("aria-label", "Bulldoze");
    const iconWrap = el("span");
    iconWrap.innerHTML = ICONS["bulldoze"] || "";
    b.appendChild(iconWrap);
    b.appendChild(el("span", "tool-label", "Bulldoze"));
    b.addEventListener("click", () => actions.selectTool("bulldoze"));
    bulldozeGrid.appendChild(b);
    toolBtns["bulldoze"] = b;
  }
  bulldozeGroup.appendChild(bulldozeGrid);
  dockScroll.appendChild(bulldozeGroup);

  // Cost strip (shows during drag preview)
  const costStrip = el("div");
  costStrip.id = "cost-strip";
  dockScroll.appendChild(costStrip);

  function toggleGroup(id) {
    const g = groupEls[id];
    if (!g) return;
    const open = g.el.classList.toggle("open");
    g.header.setAttribute("aria-expanded", String(open));
  }

  function expandGroup(id) {
    const g = groupEls[id];
    if (!g) return;
    g.el.classList.add("open");
    g.header.setAttribute("aria-expanded", "true");
  }

  // Open zone group by default
  if (groupEls["zone"]) expandGroup("zone");

  // Overlay section (pinned at bottom of dock)
  const overlaySection = el("div");
  overlaySection.id = "overlay-section";
  const overlayLbl = el("div", "overlay-section-label", "Map Overlay");
  overlaySection.appendChild(overlayLbl);
  const overlayGrid = el("div", "overlay-grid");
  overlaySection.appendChild(overlayGrid);
  rightDock.appendChild(overlaySection);

  [
    { id: "none",      label: "None" },
    { id: "power",     label: "Power" },
    { id: "water",     label: "Water" },
    { id: "landvalue", label: "Land $" },
    { id: "pollution", label: "Pollut." },
    { id: "crime",     label: "Crime" },
    { id: "traffic",   label: "Traffic" },
    { id: "police",    label: "Police" },
    { id: "fire",      label: "Fire" },
    { id: "health",    label: "Health" },
    { id: "education", label: "Educ." },
  ].forEach(({ id, label }) => {
    const b = el("button", id === "none" ? "overlay-btn active" : "overlay-btn", label);
    b.dataset.overlay = id;
    b.setAttribute("aria-label", `${label} overlay`);
    b.addEventListener("click", () => actions.setOverlay(id));
    overlayGrid.appendChild(b);
  });

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  const bottomBar = el("div");
  bottomBar.id = "bottom-bar";
  app.appendChild(bottomBar);

  // Speed group
  const speedGroup = el("div");
  speedGroup.id = "speed-group";
  const speedRow = el("div", "speed-label-row");
  [
    { n: 0, label: "⏸", title: "Pause [0]" },
    { n: 1, label: "1×", title: "Normal [1]" },
    { n: 2, label: "2×", title: "Fast [2]" },
    { n: 3, label: "3×", title: "Very fast [3]" },
  ].forEach(({ n, label, title }) => {
    const b = el("button", n === 0 ? "speed-btn active" : "speed-btn", label);
    b.dataset.speed = String(n);
    b.title = title;
    b.setAttribute("aria-pressed", n === 0 ? "true" : "false");
    b.addEventListener("click", () => actions.setSpeed(n));
    speedRow.appendChild(b);
  });
  speedGroup.appendChild(speedRow);
  bottomBar.appendChild(speedGroup);

  // RCI demand section
  const rciSection = el("div");
  rciSection.id = "rci-section";
  const rciTitle = el("div", "rci-section-title", "Demand");
  rciSection.appendChild(rciTitle);

  function rciRow(cls, labelText) {
    const row = el("div", "rci-row");
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

  const rciR = rciRow("r", "R");
  const rciC = rciRow("c", "C");
  const rciI = rciRow("i", "I");
  bottomBar.appendChild(rciSection);

  // News + hint
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
  const newsTicker = el("div");
  newsTicker.id = "news-ticker";
  newsTicker.textContent = "Welcome to City Builder 3000.   ·   Build roads first, then zone residential areas nearby.   ·   Add power and water to help your city grow.   ·   Welcome to City Builder 3000.   ·   Build roads first, then zone residential areas nearby.   ·   Add power and water to help your city grow.";
  newsScroll.appendChild(newsTicker);
  newsTickerWrap.appendChild(newsScroll);
  newsWrap.appendChild(newsTickerWrap);
  bottomBar.appendChild(newsWrap);

  // Money + date
  const moneyDate = el("div");
  moneyDate.id = "money-date";
  const moneyDisplay = el("div");
  moneyDisplay.id = "money-display";
  moneyDisplay.textContent = "--";
  const dateDisplay = el("div");
  dateDisplay.id = "date-display";
  dateDisplay.textContent = "--";
  moneyDate.appendChild(moneyDisplay);
  moneyDate.appendChild(dateDisplay);
  bottomBar.appendChild(moneyDate);

  // Zoom buttons (right of bottom bar)
  const zoomGroup = el("div", "nav-row");
  zoomGroup.style.cssText = "margin-left:2px; flex-shrink:0";
  const zInBtn = btn("nav-btn", "+", "Zoom in [+]", () => actions.zoom?.(1));
  const zOutBtn = btn("nav-btn", "−", "Zoom out [−]", () => actions.zoom?.(-1));
  const homeBtn = btn("nav-btn", "⌂", "Home view [H]", () => actions.home?.());
  zoomGroup.appendChild(zInBtn);
  zoomGroup.appendChild(zOutBtn);
  zoomGroup.appendChild(homeBtn);
  bottomBar.appendChild(zoomGroup);

  // ── Navigator (lower-right, above bottom bar) ──────────────────────────────
  const navigator = el("div");
  navigator.id = "navigator";
  app.appendChild(navigator);

  const navTop = el("div", "nav-row");
  navTop.appendChild(btn("nav-btn", "↺", "Rotate left", () => actions.rotate?.(-1)));
  navTop.appendChild(btn("nav-btn", "↻", "Rotate right", () => actions.rotate?.(1)));
  navigator.appendChild(navTop);

  // ── Build preview ──────────────────────────────────────────────────────────
  const buildPreview = el("div");
  buildPreview.id = "build-preview";
  app.appendChild(buildPreview);
  const bpInner = el("div", "build-preview-inner");
  const bpCount = el("span", "preview-count", "");
  const bpCost  = el("span", "preview-cost", "");
  const bpMsg   = el("span", "preview-msg", "");
  bpInner.appendChild(bpCount);
  bpInner.appendChild(bpCost);
  bpInner.appendChild(bpMsg);
  buildPreview.appendChild(bpInner);

  // ── Notification ──────────────────────────────────────────────────────────
  const notif = el("div");
  notif.id = "notif";
  notif.setAttribute("role", "status");
  app.appendChild(notif);
  let notifTimer = null;

  // ── Budget dialog ──────────────────────────────────────────────────────────
  const budgetDialog = document.createElement("dialog");
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
    ["income.residential", "Residential tax"], ["income.commercial", "Commercial tax"], ["income.industrial", "Industrial tax"], ["income.ordinances", "Ordinance income"],
    ["expenses.police", "Police"], ["expenses.fire", "Fire"], ["expenses.health", "Health"], ["expenses.education", "Education"],
    ["expenses.transport", "Transportation"], ["expenses.utilities", "Utilities"], ["expenses.sanitation", "Sanitation"], ["expenses.parks", "Parks"],
    ["expenses.ordinances", "Ordinance costs"], ["expenses.loans", "Loan payments"],
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

  // Budget summary
  const budSummary = el("div", "modal-section");
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

  // Loan / repay
  const loanRow = el("div", "slider-row");
  loanRow.style.marginTop = "8px";
  loanRow.appendChild(btn("btn btn-sm", "Take Loan $10K", "Take a $10,000 loan", () => {
    actions.setPolicy?.("loan", 10000);
    budgetDialog.close();
  }));
  loanRow.appendChild(btn("btn btn-sm btn-danger", "Repay Loan", "Repay outstanding loan", () => {
    actions.setPolicy?.("repayLoan", true);
    budgetDialog.close();
  }));
  budSummary.appendChild(loanRow);
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

  const repGraphWrap = el("div", "modal-section");
  repGraphWrap.appendChild(el("div", "modal-section-title", "Population History"));
  const repGraphEl = el("div");
  repGraphWrap.appendChild(repGraphEl);
  repBody.appendChild(repGraphWrap);

  const repStatsSection = el("div", "modal-section");
  repStatsSection.appendChild(el("div", "modal-section-title", "City Statistics"));
  const repStatGrid = el("div", "stat-grid");
  const repStats = {};
  [
    ["population", "Population"],
    ["jobs", "Jobs"],
    ["unemployment", "Unemployment"],
    ["happiness", "Happiness"],
    ["health", "Health"],
    ["education", "Education"],
    ["pollution", "Pollution"],
    ["crime", "Crime"],
    ["traffic", "Traffic"],
    ["garbage", "Garbage"],
  ].forEach(([k, label]) => {
    const item = el("div", "stat-item");
    item.appendChild(el("span", "stat-item-label", label));
    const v = el("span", "stat-item-val", "--");
    item.appendChild(v);
    repStatGrid.appendChild(item);
    repStats[k] = v;
  });
  repStatsSection.appendChild(repStatGrid);
  repBody.appendChild(repStatsSection);

  const repFooter = el("div", "modal-footer");
  repFooter.appendChild(btn("btn btn-teal", "Close", null, () => reportDialog.close()));
  reportDialog.appendChild(repFooter);

  reportDialog.addEventListener("click", (e) => {
    if (e.target === reportDialog) reportDialog.close();
  });

  let _lastStats = null;

  function buildReport() {
    const s = _lastStats;
    if (!s) return;
    const history = s.history || [];
    repGraphEl.innerHTML = history.length >= 2
      ? buildHistoryGraph(history, "population", "var(--res)")
      : "<p style='color:var(--text-dim);font-size:.6rem'>Not enough history yet.</p>";

    const fmt = (k, v) => {
      if (v == null) return "--";
      if (["population", "jobs"].includes(k)) return fmtPop(v);
      return fmtPct(v);
    };
    Object.entries(repStats).forEach(([k, el]) => {
      el.textContent = fmt(k, s[k]);
      el.className = "stat-item-val";
      if (k === "pollution" || k === "crime" || k === "garbage" || k === "traffic") {
        if (s[k] > 70) el.classList.add("neg");
        else if (s[k] > 40) el.classList.add("warn");
      } else if (k === "health" || k === "education" || k === "happiness") {
        if (s[k] < 30) el.classList.add("neg");
        else if (s[k] < 60) el.classList.add("warn");
      }
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

  function renderAdvisor(parent, { name, role, mood, message }) {
    const card = el("div", "advisor-card");
    const dot = el("div", `advisor-mood ${mood || "good"}`);
    card.appendChild(dot);
    const info = el("div");
    info.appendChild(el("div", "advisor-name", name + (role ? ` — ${role}` : "")));
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
  disMsg.style.cssText = "font-size:.62rem;color:var(--text-dim);line-height:1.55";
  disMsg.textContent = "Trigger a disaster on your city. Funded fire stations contain fires; damaged roads cut off neighborhoods.";
  disBody.appendChild(disMsg);
  const disRow = el("div", "slider-row");
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
  disasterDialog.appendChild(disBody);

  const disFooter = el("div", "modal-footer");
  disFooter.appendChild(btn("btn", "Cancel", null, () => disasterDialog.close()));
  disasterDialog.appendChild(disFooter);

  disasterDialog.addEventListener("click", (e) => {
    if (e.target === disasterDialog) disasterDialog.close();
  });

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

  helpSection("Navigation", [
    ["WASD / ↑↓←→", "Pan the map"],
    ["Scroll", "Zoom in / out"],
    ["Right drag", "Pan the map"],
    ["H", "Home view"],
    ["+ / −", "Zoom in / out"],
  ]);
  helpSection("Building", [
    ["Click/drag", "Place selected tool"],
    ["Drag rectangle", "Zone an area (release to commit)"],
    ["Esc", "Switch to inspect mode"],
    ["Ctrl+Z", "Undo last action"],
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
  cfmMsg.style.cssText = "font-size:.62rem;color:var(--text-dim);line-height:1.55;margin:0 0 8px";
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
  form.money = formRow("Starting funds", select("Starting funds", [["50000", "$50,000 (easy)"], ["25000", "$25,000 (medium)"], ["10000", "$10,000 (hard)"]], "50000"));
  form.start = formRow("Start with", select("Start with", [["blank", "Empty land"], ["town", "An established town"]], "blank"));
  form.scenario = formRow("Scenario", select("Scenario", [["sandbox", "Open play"], ["growth", "Grow to 20,000 in ten years"], ["recovery", "Rescue a failing town"]], "sandbox"));
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
      starter: form.start.value === "town",
      scenario: form.scenario.value,
    });
  }));
  confirmDialog.appendChild(cfmFooter);

  confirmDialog.addEventListener("click", (e) => {
    if (e.target === confirmDialog) confirmDialog.close();
  });

  // ── RCI helper ─────────────────────────────────────────────────────────────
  function updateRci(bar, demand) {
    if (demand == null) { bar.val.textContent = "--"; bar.fill.style.width = "0%"; return; }
    bar.val.textContent = `${Math.round(demand)}`;
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

      // Top metrics
      mPop.textContent    = fmtPop(stats.population);
      const funds = stats.money ?? city.money;
      mMoney.textContent  = fmtMoney(funds);
      mMoney.className    = "top-metric-val money" + (funds < 0 ? " neg" : "");
      mHappy.textContent  = stats.happiness != null ? fmtPct(stats.happiness) : "--";
      mDate.textContent   = stats.date || "--";

      // Money + date in bottom bar
      moneyDisplay.textContent = fmtMoney(funds);
      moneyDisplay.className   = funds < 0 ? "neg" : "";
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

      // News ticker
      if (Array.isArray(stats.news) && stats.news.length) {
        const text = stats.news.join("   ·   ");
        // Double the text for seamless marquee loop
        newsTicker.textContent = `${text}   ·   ${text}`;
      }
    },

    notify(message) {
      notif.textContent = message;
      notif.classList.add("show");
      if (notifTimer) clearTimeout(notifTimer);
      notifTimer = setTimeout(() => notif.classList.remove("show"), 3600);
    },

    setTool(id) {
      // Update all tool buttons
      Object.entries(toolBtns).forEach(([tid, b]) =>
        b.classList.toggle("active", tid === id),
      );
      // Inspect standalone
      inspectBtn.classList.toggle("active", id === "inspect");

      // Hint
      const tool = TOOLS.find((t) => t.id === id);
      if (tool) {
        const b = BUILDINGS[id];
        const size = b && b.w > 1 ? ` (${b.w}×${b.h})` : "";
        hintLine.textContent = id === "inspect"
          ? "Click a tile to inspect it"
          : `${tool.label}${size} — ${tool.cost > 0 ? fmtMoney(tool.cost) : "Free"} — ${PATH_TOOLS.has(id) ? "drag a route" : RECT_TOOLS.has(id) ? "drag an area" : "click to place"}`;
      }

      // Density strip visibility
      const isZone = ["residential", "commercial", "industrial"].includes(id);
      const densStrip = document.getElementById("density-strip");
      if (densStrip) densStrip.classList.toggle("visible", isZone);

      // Inspector: hide when not inspecting
      if (id !== "inspect") {
        inspPanel.classList.remove("visible");
      }

      // Auto-expand the group containing this tool
      for (const g of groups) {
        if (g.tools.includes(id)) { expandGroup(g.id); break; }
      }
    },

    setSelection(info) {
      if (!info) {
        inspPanel.classList.remove("visible");
        return;
      }
      inspPanel.classList.add("visible");
      inspTitle.textContent = info.title || "--";
      inspDesc.textContent  = info.description || "";
      inspDetails.innerHTML = "";
      if (Array.isArray(info.details)) {
        info.details.forEach((d) => inspDetails.appendChild(el("div", "insp-detail", d)));
      }
    },

    setOverlay(id) {
      overlayGrid.querySelectorAll(".overlay-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.overlay === id),
      );
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
      document.querySelectorAll(".density-btn").forEach((b) =>
        b.classList.toggle("active", Number(b.dataset.density) === n),
      );
    },

    setSpeed(n) {
      document.querySelectorAll("[data-speed]").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.speed) === n);
        b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === n));
      });
    },
  };
}
