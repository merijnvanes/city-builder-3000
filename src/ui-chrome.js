// Original vector artwork for the Periwinkle control deck. Kept separate from
// the functional tool icons used in palettes, reports and keyboard controls.
const scenes = {
  zone: `<path d="m3 32 38-18 50 18-39 15Z" fill="#77a448"/><path d="M10 27v12l14 7V33Zm28-7v13l14 7V26Zm27 8v11l14 7V34Z" fill="#e5be75"/><path d="m24 33 11-6v12l-11 7m28-20 10-6v13L52 40m27-6 11-6v11l-11 7" fill="#c58b52"/><path d="m7 27 13-12 18 11-14 8Zm28-7L47 8l18 11-13 8m10 1L75 16l18 11-14 8" fill="#c76b58"/><path d="M16 33v7m28-14v8m27 0v7" stroke="#e9f6ff" stroke-width="3"/>`,
  transport: `<path d="M1 35 70 3l24 13L24 48Z" fill="#61677e" stroke="#dcceb8" stroke-width="2"/><path d="M9 35 77 6M20 42 88 13" stroke="#ede0bb"/><path d="m24 29 8-4m6-3 8-4m6-3 8-4" stroke="#ffe295" stroke-width="2"/><path d="M32 27V9l7-3v18m25-12V0l7-3v12" fill="none" stroke="#c27161" stroke-width="3"/><path d="M35 8Q51 25 68 0" fill="none" stroke="#f3b6a0" stroke-width="2"/><path d="m48 24 11-5 8 4-11 5Z" fill="#f2be62"/>`,
  power: `<path d="m21 0-18 25h17L13 46 43 15H26L32 0Z" fill="#ffec71" stroke="#ce9c39"/><path d="M66 2 51 46m15-44 15 44M54 13h25M49 24h35M54 39h25M57 25l18 14m0-14L57 39" fill="none" stroke="#666b82" stroke-width="2"/><path d="M53 13Q41 22 34 15m46-2q9 8 18 1" fill="none" stroke="#62657e"/>`,
  water: `<path d="M27 1S8 22 8 31a19 19 0 0 0 38 0C46 22 27 1 27 1Z" fill="#5dbddd" stroke="#468bad"/><path d="M17 28q-5 10 6 13" fill="none" stroke="#d2f7fa" stroke-width="3" stroke-linecap="round"/><path d="M58 43V17h20v26m-20-13h20m-16-13V5h13v12" fill="none" stroke="#a5afb9" stroke-width="7"/><path d="M58 42V17h20v26" fill="none" stroke="#e4e9e4" stroke-width="2"/>`,
  civic: `<path d="M5 20 47 0l43 20Z" fill="#f8e9c8" stroke="#9b9384"/><path d="M11 21h73v22H11Z" fill="#b5c3c6"/><path d="M18 22v22m14-22v22m14-22v22m14-22v22m14-22v22" stroke="#fff1d2" stroke-width="7"/><path d="M5 45h86" stroke="#ede2c5" stroke-width="5"/><circle cx="47" cy="12" r="4" fill="#86a0ba"/>`,
  sanitation: `<path d="m4 38 34-16 48 17-34 12Z" fill="#91b477"/><path d="M30 13h36l-4 30H34Z" fill="#7d9da4" stroke="#506f80"/><path d="M26 13h44m-30-5h17" stroke="#bfcac3" stroke-width="5" stroke-linecap="round"/><path d="m45 19 5-1 5 8m1 6-2 5h-9m-6-5-3-4 5-8" fill="none" stroke="#ecf3bf" stroke-width="3"/><path d="m49 24 6 2 2-6m-10 16-3 2 4 4m-12-18 5-4 3 4" fill="none" stroke="#ecf3bf" stroke-width="2"/>`,
  landscape: `<path d="m0 32 30-16 31 7L83 9l13 19-38 20Z" fill="#81ac59"/><path d="m0 39 31-16 29 8L82 18l14 17-37 13Z" fill="#a5ca70"/><path d="m57 45 12-11 15 2 12-5" fill="none" stroke="#77c2d5" stroke-width="6"/><path d="M19 29V12m22 15V7m37 15V7" stroke="#8a7645" stroke-width="3"/><g fill="#488946"><circle cx="19" cy="12" r="9"/><circle cx="41" cy="7" r="9"/><circle cx="78" cy="7" r="8"/></g><g fill="#88b957"><circle cx="16" cy="9" r="5"/><circle cx="38" cy="4" r="5"/><circle cx="75" cy="5" r="4"/></g>`,
  landmark: `<path d="m9 39 34-16 40 16-36 12Z" fill="#82a683"/><path d="M35 43V13h21v30" fill="#f0d5b1" stroke="#af9984"/><path d="M32 14 45 1l14 13Z" fill="#8489ad"/><path d="M45 0v-5" stroke="#ecc677" stroke-width="2"/><circle cx="45" cy="22" r="7" fill="#fff4d3" stroke="#a58a69"/><path d="M45 17v5l4 2" fill="none" stroke="#627489" stroke-width="2"/><path d="M41 44v-9h9v9" fill="#8d99ae"/>`,
  special: `<path d="m7 33 38-16 40 17-37 17Z" fill="#9bba76"/><path d="M31 38h30v7H31m7-10h17v4H38" fill="#e2c582"/><path d="M45 1 51 14l15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z" fill="#ffe099" stroke="#b99451"/><path d="m45 7 3 10 11 1-10 7" fill="none" stroke="#fff6d1" stroke-width="2"/>`,
  emergency: `<path d="m5 6 23-5 22 5v19Q47 40 28 47 8 40 5 25Z" fill="#bc6e72" stroke="#f6bd9c" stroke-width="2"/><path d="m28 10 4 9 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1Z" fill="#ffe4a2"/><rect x="58" y="13" width="30" height="29" rx="6" fill="#fff0d4"/><path d="M73 19v18m-9-9h18" stroke="#d06960" stroke-width="7"/>`,
  bulldoze: `<path d="M8 29h55v12H8Z" fill="#997852"/><rect x="8" y="34" width="57" height="13" rx="6" fill="#67717b"/><path d="M18 25V8h22v20m0-8h16l7 14H16V25Z" fill="#e7b761" stroke="#9d814f"/><path d="M22 11h14v13H22Z" fill="#b2d4d9"/><path d="m71 24 12-7v30L71 42Z" fill="#c7b3a3" stroke="#857a79"/><path d="M58 31h14" stroke="#d1a45b" stroke-width="5"/><path d="M17 40h37" stroke="#a7adb3" stroke-width="3" stroke-dasharray="4 4"/>`,
};

export function categoryArt(id) {
  return `<svg viewBox="0 -6 96 58" aria-hidden="true" focusable="false">${scenes[id] || scenes.civic}</svg>`;
}

const NAV_ICONS = {
  game: '<path d="M5 3h12l3 3v15H4V3h1Zm2 0v7h10V3M8 21v-7h8v7"/><path d="M13 5v3"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
  left: '<path d="M5 10a7 7 0 1 1 1 8M5 4v6h6"/>',
  right: '<path d="M19 10a7 7 0 1 0-1 8m1-14v6h-6"/>',
};
export function navigationArt(id) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[id]}</svg>`;
}

export function mountNavigatorFrame(navigator) {
  navigator.innerHTML = '<svg class="navigator-frame" aria-hidden="true"><defs><linearGradient id="navigator-enamel" gradientUnits="userSpaceOnUse"><stop stop-color="#eef0ff"/><stop offset=".45" stop-color="#dce0f6"/><stop offset="1" stop-color="#adb6de"/></linearGradient></defs><path fill="url(#navigator-enamel)"/><path fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><path fill="none" stroke="#a2add5" stroke-opacity=".4" stroke-width="4"/></svg>';
  const observer = new ResizeObserver(() => {
    const w = navigator.clientWidth, h = navigator.clientHeight;
    const console = document.querySelector('#build-console'), deck = document.querySelector('#console-deck');
    // A resize can arrive after the interface has been torn down or before
    // the console exists; there is nothing to frame then.
    if (!console || !deck || !navigator.isConnected) return;
    const rail = console.clientWidth, height = console.clientHeight;
    const shoulder = height - h;
    const radius = parseFloat(getComputedStyle(deck).borderTopLeftRadius);
    const x = w - rail;
    const footer = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--status-height')) + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--news-height'));
    const join = Math.max(0, h - footer);
    const svg = navigator.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
    const gradient = svg.querySelector('linearGradient');
    gradient.setAttribute('x1', x); gradient.setAttribute('x2', w);
    const paths = svg.querySelectorAll(':scope > path');
    const edge = (inset) => `M${x + inset + radius} 0Q${x + inset} 0 ${x + inset} ${radius}V${shoulder}C${x + inset} ${shoulder + join * .16} ${x * .88 + inset} ${shoulder + join * .22} ${x * .68 + inset} ${shoulder + join * .36}L${x * .3 + inset} ${shoulder + join * .63}Q${inset} ${shoulder + join * .83} ${inset} ${shoulder + join}`;
    paths[0].setAttribute('d', `${edge(0)}V${height}H${w}V0Z`);
    for (const [i, inset] of [[1, 5], [2, 10]]) paths[i].setAttribute('d', edge(inset));
  });
  observer.observe(navigator);
  observer.observe(document.querySelector('#console-deck'));
}
