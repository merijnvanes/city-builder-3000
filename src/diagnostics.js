// What to tell somebody when the game goes wrong.
//
// There is no server and no error reporting service, on purpose: nothing about
// a player's city leaves their browser unless they send it. That leaves a gap.
// "It broke" is not a bug report, and asking a player to open developer tools
// and read a stack trace aloud is not either.
//
// So the game writes the report itself, and the player decides whether to send
// it. Everything here is either already on screen or already in the page: the
// build, the browser, the size of the window, the state of the city, what the
// storage said, and the error if there was one. No identifiers are invented,
// nothing is collected over time, and the city's name is the player's own words
// going onto the player's own clipboard.

const round = (value, places = 2) => (Number.isFinite(value) ? Number(value.toFixed(places)) : null);

// The hashed bundle filename identifies the build exactly, and it is already in
// the page. A version string would have to be invented, kept up to date, and
// would still say less.
function buildOf(document) {
  // The hashed name lives under /assets. The dev server puts its own
  // /@vite/client module in the page first, and naming that would report
  // "client" as the build on every developer's machine.
  const scripts = document?.querySelectorAll?.('script[type="module"][src]') || [];
  for (const script of scripts) {
    const src = String(script.getAttribute?.("src") || script.src || "");
    if (src.includes("/assets/")) return src.split("/").pop() || "development";
  }
  return "development";
}

export function collectDiagnostics({
  city, stats, renderer, spriteStats, storage, crash, tool, speed, canvas, quota,
  navigator: agent = globalThis.navigator,
  location: where = globalThis.location,
  document: page = globalThis.document,
  screen: display = globalThis.screen,
  performance: timing = globalThis.performance,
} = {}) {
  const report = {
    build: buildOf(page),
    page: where?.pathname ?? null,
    upFor: round((timing?.now?.() ?? 0) / 1000, 1),
    browser: {
      // The user agent is what it is: the one string that reliably says which
      // engine and version a report came from.
      userAgent: agent?.userAgent ?? null,
      language: agent?.language ?? null,
      cores: agent?.hardwareConcurrency ?? null,
      memory: agent?.deviceMemory ?? null,
      online: agent?.onLine ?? null,
    },
    display: {
      window: page?.documentElement ? `${page.documentElement.clientWidth}x${page.documentElement.clientHeight}` : null,
      screen: display ? `${display.width}x${display.height}` : null,
      dpr: round(globalThis.devicePixelRatio, 2),
      rendererDpr: renderer?.dpr ?? null,
      zoom: round(renderer?.zoom, 3),
      rotation: renderer?.rotation ?? null,
      night: renderer?.night ?? null,
      // A 2D context stops drawing when its backing buffer is larger than the
      // GPU will allow, and nothing on screen says so.
      canvas: canvas ? `${canvas.width}x${canvas.height}` : null,
    },
    city: city ? {
      name: city.name,
      size: city.size,
      month: city.month,
      date: stats?.date ?? null,
      population: stats?.population ?? city.population,
      money: Math.round(stats?.money ?? city.money),
      scenario: city.scenario ?? null,
      revision: city.revision,
      speed: speed ?? null,
      tool: tool ?? null,
    } : null,
    storage: storage ?? null,
    quota: quota ?? null,
    artwork: spriteStats ? {
      entries: spriteStats.entries,
      heldMB: round(spriteStats.decodedBytes / 1048576, 1),
      budgetMB: round(spriteStats.maxDecodedBytes / 1048576, 1),
      loads: spriteStats.loads,
      speculative: spriteStats.speculativeLoads,
    } : null,
    error: crash ? {
      // The name separates a RangeError from a QuotaExceededError, and the
      // rejection flag says whether anything was even on the stack.
      name: crash.name ?? null,
      message: crash.message,
      source: crash.source ?? null,
      rejection: crash.rejection ?? false,
      stack: crash.stack ?? null,
    } : null,
  };
  return report;
}

// Plain text, because it is going into a message somebody types. JSON would be
// smaller and less likely to be read. Every field is reached defensively: the
// report is written when the game has just broken, and a formatter that throws
// on a missing section is a report nobody gets.
export function formatDiagnostics(report = {}) {
  const lines = [];
  const put = (label, value) => { if (value !== null && value !== undefined && value !== "") lines.push(`${label}: ${value}`); };
  const section = (title, rows) => {
    const written = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
    if (!written.length) return;
    lines.push("", title);
    for (const [label, value] of written) lines.push(`  ${label}: ${value}`);
  };

  lines.push("City Builder 3000 — diagnostics");
  put("Build", report.build);
  put("Page", report.page);
  put("Open for", report.upFor === null || report.upFor === undefined ? null : `${report.upFor}s`);

  section("Browser", [
    ["Agent", report.browser?.userAgent],
    ["Language", report.browser?.language],
    ["Cores", report.browser?.cores],
    ["Memory (GB, approximate)", report.browser?.memory],
    ["Online", report.browser?.online],
  ]);

  section("Display", [
    ["Window", report.display?.window],
    ["Screen", report.display?.screen],
    ["Device pixel ratio", report.display?.dpr],
    ["Renderer pixel ratio", report.display?.rendererDpr],
    ["Canvas", report.display?.canvas],
    ["Zoom", report.display?.zoom],
    ["Rotation", report.display?.rotation],
    ["Night", report.display?.night],
  ]);

  section("City", [
    ["Name", report.city?.name],
    ["Map", report.city?.size ? `${report.city.size}x${report.city.size}` : null],
    ["Date", report.city?.date],
    ["Month", report.city?.month],
    ["Population", report.city?.population],
    ["Funds", report.city?.money],
    ["Scenario", report.city?.scenario],
    ["Revision", report.city?.revision],
    ["Speed", report.city?.speed],
    ["Tool", report.city?.tool],
  ]);

  section("Storage", [
    ...Object.entries(report.storage || {}),
    ["Used", report.quota?.usage === undefined ? null : `${report.quota.usage} MB of ${report.quota.limit} MB`],
    ["Persisted", report.quota?.persisted],
  ]);

  section("Artwork cache", [
    ["Entries", report.artwork?.entries],
    ["Held", report.artwork?.heldMB === null || report.artwork?.heldMB === undefined
      ? null : `${report.artwork.heldMB} MB of ${report.artwork.budgetMB} MB`],
    ["Loads", report.artwork?.loads],
    ["Warmed ahead", report.artwork?.speculative],
  ]);

  section("Error", [
    ["Name", report.error?.name],
    ["Message", report.error?.message],
    ["Where", report.error?.source],
    ["From a rejected promise", report.error?.rejection || null],
  ]);
  if (report.error?.stack) {
    lines.push("  Stack:", ...String(report.error.stack).split("\n").map((line) => `    ${line.trim()}`));
  }

  return lines.join("\n");
}

// The clipboard needs a secure context and a gesture, and can still refuse.
//
// There is no second automatic attempt. execCommand would need the click that
// is already spent by the time an awaited writeText has rejected, so it would
// fail too, and an invisible textarea appended and removed leaves nothing for
// the player who was just told to select the text by hand. A refusal returns
// the text instead, and the caller shows it.
export async function copyText(text, { clipboard = globalThis.navigator?.clipboard } = {}) {
  if (!clipboard?.writeText) {
    return { ok: false, text, message: "This browser does not let a page write to the clipboard." };
  }
  try {
    await clipboard.writeText(text);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, text, message: `The clipboard was refused (${err.message}).` };
  }
}
