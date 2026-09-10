# City Builder 3000

A browser city builder in the spirit of the classic isometric city games. Vanilla JS, Canvas 2D, no runtime dependencies and original artwork. Production civic buildings use offline-rendered Blender models; other artwork is currently procedural.

## Quick start

```bash
pnpm install
pnpm dev           # dev server at http://127.0.0.1:5173
```

## Build and deploy

```bash
pnpm build         # outputs to dist/
pnpm deploy        # builds, then ships it to citybuilder.mulletiq.com
```

The game is served at <https://citybuilder.mulletiq.com> by Cloudflare Workers static assets.
`wrangler.jsonc` holds the whole deployment: `dist/` as the asset directory, the custom domain,
and no `main`, because nothing here needs a server. Pushing to `main` deploys, through the
`deploy` job in `.github/workflows/ci.yml`, which runs only after the tests in that file pass.
It needs one repository secret, `CLOUDFLARE_API_TOKEN`, with the *Edit Cloudflare Workers*
template on the Cloudflare account that owns this domain's zone.

That worker publishes exactly one hostname. `workers_dev` and `preview_urls` are both off in
`wrangler.jsonc`, because a second address serving the same game splits the saved cities:
`src/save-store.js` keeps them in IndexedDB, which is scoped to the origin, so a player who
arrives on the other address finds an empty map.

`dist/` is otherwise a self-contained static site and will run on any static host.

`public/_headers` travels with it and is read from the build root by Cloudflare Workers, by
Cloudflare Pages and by Netlify. Any other host needs the same two rules expressed its own way,
and they are not optional. Everything under `/assets` carries a content hash in its name, from Vite for the code
and from `tools/civic_art/package.py` for the artwork, so its URL changes whenever its bytes do
and it is cached for a year. The HTML keeps a fixed URL and names those hashed files, so it is
revalidated on every load. Cache the HTML instead and a returning player gets a page pointing at
a bundle that was deleted three deploys ago.

No path may match two rules that set the same header. Cloudflare Pages appends the second value
rather than replacing the first, so narrowing `/assets/*` for one file would send both policies
at once and a browser that honours `immutable` would keep it for a year anyway. Anything that
cannot be cached forever lives outside `/assets`: that is why the artwork catalogue the gallery
page reads is `public/civic-catalog.json` at the build root and not under the sprites it
describes. `tests/deploy-headers.test.js` checks every file in a finished build against these
rules, including that no two of them overlap, so run `pnpm build` before `pnpm test` to
exercise it.

The same file carries the security headers, applied to every path. The policy is
`default-src 'none'` with `'self'` opened only for script, style, images, the font and
`connect-src`, and `media-src`, `worker-src`, `object-src`, `frame-ancestors`, `base-uri` and
`form-action` all `'none'`. `worker-src` is spelled out because it otherwise falls back to
`script-src` and would be permitted by a policy that reads as shut. Alongside it: `nosniff`,
`no-referrer`, same-origin COOP and CORP, HSTS for a year with `includeSubDomains` (which
commits every subdomain of whatever domain this is served from to HTTPS), and a
Permissions-Policy denying the named features — an omitted feature keeps its own default rather
than being denied.

The game loads nothing from anywhere else and never calls out, so nothing needs
`'unsafe-inline'`: neither page carries an inline script or stylesheet, no element carries a
style attribute, and no script builds CSS from a string through `style.cssText`. The tests fail
if any of those appears.

```bash
pnpm test:deploy   # build, check the headers, then play the built site through them
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: install, `pnpm build`, a check
that the build produced a deployable site, then `pnpm test`. The build comes first because
`tests/deploy-headers.test.js` inspects a finished build and skips itself when there is none.

The same file carries the deploy, as a second job gated on `needs: test` and limited to a push
to `main`. It is the same question asked once: the tests decide whether main is good, and there
is no version of "good enough to keep" that differs from "good enough to serve". A separate
workflow would have to either repeat the whole suite on every push to main or race it, and
racing it means a push that breaks the simulation reaches the live site before anything notices.
The job holds a `deploy-citybuilder` concurrency group with `cancel-in-progress: false`, because
wrangler uploads the artwork before it moves the live version onto it and a run killed halfway
leaves that upload half done.

`.github/workflows/nightly.yml` runs the suites that need a real browser: `pnpm test:deploy`
first, since it serves its own copy of `dist/`, then gameplay, the interface at nine window
sizes, the scene and geometry checks, the rendering and building-family galleries, the zones,
and the renderer benchmark against a dev server on 4173. Each step runs even if an earlier one
failed, so one break does not hide the rest for a day, and `artifacts/` is uploaded either way.
It runs at 03:00 UTC and on demand. GitHub disables a scheduled workflow after 60 days without
repository activity; run it from the Actions tab to wake it up.

Three browser suites are left out of nightly, named with their reasons at the top of the
workflow, because they already fail: `test:working-set` and `test:transport` assert counts that
the game has since grown past (50 building types against 65, 9 transport layouts against 20
after the port modules), and `test:art-production` wants a built site served under `/nested/` on
port 4217 that no script starts. Those numbers are meant to be looked at rather than raised
blindly, so they are still failing on purpose. Add each suite back to nightly as it is fixed.

The page shows a loading screen from the moment it is parsed. The game cannot draw until the
bundle has run and a city has been laid out, which on a slow connection is about four seconds of
window that used to be blank. The markup is static in `index.html`; its stylesheet
(`public/boot.css`) and `public/boot.js` are linked separately so both are in effect before the
bundle has run, and `main.js` removes the screen on the first rendered frame.

**Browsers**: Chrome and Edge 108, Firefox 121, Safari 16, or newer. Chrome and Safari are set
by the JavaScript the game uses directly — `WeakRef`, `structuredClone`, `dialog.showModal`,
`ResizeObserver`, `Object.hasOwn`, `String.replaceAll`, `Array.at` — and by `build.target` in
`vite.config.js`, which is pinned rather than left to Vite's default so the floor is a decision
and not something a Vite upgrade moves. Firefox is set by CSS `:has()`, which hides panels that
would otherwise sit on top of each other; without it the interface is unusable rather than
slightly wrong. `public/boot.js` checks each of those before the bundle runs and, when one is
missing, names it on the page and stops the game rather than leaving a canvas that never draws.
The bundle is still fetched — the module tag is in the HTML and nothing here can call it
back — but `src/main.js` reads the mark `boot.js` leaves on the root element and stops before it
does anything.

**Where your city is kept**: the game menu and the help dialog both open a short note saying
that cities are kept in this browser on this device and nowhere else, that there is no account
and no server, and that the game never sends the city anywhere — along with the awkward half of
that, which is that nothing is backed up either. A browser may clear what a site stored, a
private window keeps nothing past closing, the persistent-storage request is a request rather
than a guarantee, another browser or device starts again, and nothing here is locked against
anyone else using the same device. The note points at Export to file, and its own buttons go
there.

The note reads the live storage state rather than asserting one, so it says whether cities are
going into IndexedDB, into the smaller localStorage fallback, or nowhere at all because the
browser is refusing. `tests/privacy.mjs` checks that what the note says matches what
`saveStore.mode()` actually reports, that the persistent-storage request is really made, and
that across a played, saved, loaded and rotated city plus the gallery page nothing was requested
from another origin and no request carried a body — a same-origin POST with a city in it would
be invisible to a check on hostnames alone.

**Reporting a problem**: the game menu and the crash dialog both offer **Copy diagnostics**,
which puts a plain-text report on the clipboard — the exact build (the hashed bundle filename,
so no version string has to be invented and kept true), the browser, the window and canvas, the
state of the city, where saves were going and whether the last one landed, how much room the
browser is giving the origin, the artwork cache, and the error with its name and stack when
there is one. Nothing is sent anywhere: the game has no server and calls nothing, so the player
decides what to share, and "it went wrong" stops being the whole bug report.

Every part is gathered separately, because the report is written exactly when the game is least
able to answer questions about itself: one source that throws costs its own section rather than
the whole report. A refused clipboard shows the report in a dialog to select by hand, and a
crash before the interface exists writes it into the page as text. See `src/diagnostics.js`.

`boot.js` exists for the one failure the crash guard cannot reach: a bundle that never runs
cannot report itself from inside the bundle. It notices a script or stylesheet that failed to
download, and gives up after 25 seconds, so the screen stops claiming progress instead of
saying "Laying out the streets…" indefinitely. `tests/boot.mjs` measures the covered gap on a
throttled connection, fails if the screen stops earning its place, and aborts the bundle to
check that a game which never starts says so.

The sprite manifest, the largest module in the bundle, is generated as a string handed to
`JSON.parse` rather than as an object literal: a purpose-built parser that knows the shape of
what it is reading beats parsing a megabyte as possible code. Importing it goes from about 10 ms
to about 7 ms, and the source file halves. See `write_manifest()` in
`tools/civic_art/package.py`.

A service worker (`public/sw.js`) gives offline play and keeps artwork through a cleared HTTP
cache. It splits on whether a URL can ever mean something different: everything under `/assets`
is content-hashed and answered from the cache without asking the network, and everything else
goes to the network first and falls back to the cache only when there is none.

Two caches, for two lifetimes. The shell — the document and the bundle, stylesheet and font it
names — is written as a set, by a page that has actually run that build, and is never evicted.
Writing them together is the point: a document cached without its bundle is a blank screen
offline, and a document cached by a worker that is still waiting names a bundle nobody has
fetched. The artwork cache is capped and evicted oldest-first, and its name carries no version,
because a hashed sprite is correct forever and throwing 90 MB away on a worker update would save
nothing. There is no generated precache list; the page reports the URLs the browser actually
fetched for it.

A build that arrives mid-session **waits**. Calling `skipWaiting()` on install would swap the
code under a running game, so a notice offers the update, the city is autosaved, and the reload
happens only when the player takes it. A build that was already waiting when the page opened is
the other case: the page has just loaded over the network and is running it already, so it is
activated without a word. `tests/offline.mjs` plays with the network switched off, fills the
artwork cache past its limit, and walks three deploys arriving around a session.

That last step is the one that matters. A Content-Security-Policy reads correctly and then
blanks the page in production, because nothing in development ever applies it.
`tests/deploy-preview.mjs` serves `dist/` through the rules in `public/_headers`, plays the
game and opens the gallery under them, and fails on the first violation.

## Tests

```bash
pnpm test          # node:test unit tests for the simulation, construction and camera
pnpm test:performance # Chrome renderer benchmark against the running dev server
pnpm test:ui       # responsive controls, keyboard navigation and UI screenshots
```

With Chrome installed, run `pnpm dev --port 4173` in one terminal and `pnpm test:browser` in another for a scripted gameplay check. Screenshots land in `artifacts/`. Run `pnpm test:visuals` against the same server for Canvas pixel checks of courtyard occlusion and earthquake layering, in all camera orientations and day/night lighting. Set `CIVIC_TEST_URL` to use another server port.

Gameplay fidelity and remaining verified gaps are tracked in [PARITY.md](PARITY.md).

## Game interface

Periwinkle 3000 uses a sculpted lavender rail with illustrated tool buttons. It
flows into a large diamond minimap at the bottom right and a thin news and status
strip. Building palettes, inspection and data maps open beside the rail. The city
has no top bar over it. The rail groups tools into Zones, Land, Transport,
Utilities, Buildings and Emergency. Land includes demolition; Utilities has electricity,
water and waste tabs. Buildings contains services, parks, landmarks and
rewards. Opening a palette focuses its selected category tab or first tool;
closing it returns focus to the rail.

City management opens the mayor's office hub for finance, reports, advisors,
policies, neighbour contracts and petitions. Its detail screens return to the
hub with **Back to city management**. The dark disk button above map layers opens
the game menu for saves, new cities, sound, day/night and help.

Click or drag the minimap to move the camera. Its orientation stays fixed, and its
outline shows the camera footprint on the map plane. A gold dot marks the
camera-facing edge and follows rotation. Both move continuously with zoom and pan;
the dot stays on the map boundary when the view extends beyond it. The focused
map also accepts arrow keys. The map
stays visible, including while a construction palette is open. On phones and short
windows it fits within the rail. Zoom buttons stack to the left, with rotation
controls below the map. The layers icon opens data maps above-right of the map,
within the shortened curved housing that joins the rail.

`pnpm test:ui` checks unobstructed controls and complete card highlights across nine
desktop and mobile sizes. With the enlarged minimap, desktop checks reserve at
least 70% of the screen for the city while idle and 55% with a panel open. The
bottom console shows stacked Residential, Commercial and Industrial demand bars beside the time controls,
with Cash, Population and Happiness in the status strip. Tests
also cover map rendering and navigation, notices, petitions, and compact layouts.

## Building artwork

The civic collection establishes the visual standard for the remaining buildings.
See [CIVIC-ART.md](CIVIC-ART.md) for the shipped assets and interactive gallery, and
[ASSET-WORKFLOW.md](ASSET-WORKFLOW.md) for art direction, remaining coverage and the
production workflow. Editable sources and bake commands are documented in
[source-art/civic/README.md](source-art/civic/README.md).

## Playing with an agent

The running page exposes `window.civic.agent`, a command surface built for
software rather than for a mouse. An agent drives the same city you are
looking at, so you keep playing and watch it work.

```js
civic.agent.help()                              // every command, tool and policy
civic.agent.state()                             // money, demand, budget, advisors
civic.agent.overview()                          // the whole map as a character grid
civic.agent.region(20, 20, 30, 20)              // one window in full detail
civic.agent.objects({ problem: true })          // what is built and what is wrong
civic.agent.find("coal", { near: { x: 30, y: 40 } })
civic.agent.build("road", 22, 50, 22, 60)       // same drag the mouse makes
civic.agent.run(12)                             // advance a year
```

Reach it from any browser automation with a single evaluate call, for example
Playwright's `page.evaluate(() => civic.agent.state())`. There are no
screenshots and no coordinate clicking.

Every command that changes the city announces itself: a notice on screen, a
line in the news ticker, and the camera moves to the work when it is off
screen. `civic.agent.log()` replays what the agent did.

The map accessors are level of detail on purpose. `overview()` and `field()`
fold the map into a fixed grid, so they cost the same on a 64×64 map and a
256×256 one. `region()` is bounded by the window you ask for. `objects()`
scales with what is built, not with map area, and reports a 3×3 lot as one
entry. Nothing ever returns the whole tile array.

## The game

- **Maps** of 64×64, 96×96 or 128×128 tiles with rivers, coasts, lakes, beaches and forests. Start on empty land or with an established town, with $10K–$50K.
- **Zones**: residential, commercial and industrial at three densities. Zoned tiles form 1×1, 2×2 or 3×3 lots that develop through four stages, decline when conditions fail and get abandoned when demand collapses.
- **Demand** follows the jobs/housing loop: jobs attract residents, residents attract shops, industry follows the workforce and outside trade. Taxes, services, pollution and unemployment shift each curve.
- **Power** flows from six plant types through power lines, zones and buildings and hops a single road. Plants have capacity; overload means brownouts.
- **Water** comes from pumps (best beside water), towers and treatment plants through underground pipes; each pipe serves the six tiles around it.
- **Services**: police, fire, hospitals, schools, colleges, libraries, museums, landfills, incinerators, recycling, parks and zoos. Coverage depends on distance and department funding.
- **Transport**: roads and elevated highways with commuting traffic that routes around jams, on-ramps that climb from a street to the deck, rail with stations, subways with stations, bus stops, and airport and seaport zones that fill with runways, terminals, hangars, quays, piers and cargo yards as trade grows.
- **Budget**: separate R/C/I taxes, six funded departments, eighteen ordinances, amortised loans, a monthly ledger and yearly figures available in Budget. January autosaves without opening a report or pausing play. So does every minute of play, and putting the page away. The minute is the one that counts: closing a desktop tab kills the page before an IndexedDB write can commit, so the guarantee is not that nothing is lost but that no more than the last minute of it is. `visibilitychange` is the trigger to trust on a phone, where it arrives while the page is still alive; `pagehide` is a second chance, not the plan. A city that has not changed is never written twice, and a tab that was opened, or handed a new or loaded city, never overwrites the autosave until the player changes something.
- **Directions**: the map corners are N `(0,0)`, E `(size,0)`, S `(size,size)`, W `(0,size)`. North is at the top in the default view. The edges are NE (`y=0`), SE (`x=size-1`), SW (`y=size-1`), NW (`x=0`). The simulation and API use `northeast`, `southeast`, `southwest`, `northwest` for border sides, independent of camera rotation. Version 6 saves migrate their old edge names when loaded into version 7.
- **Neighbors**: roads, highways and rails to the map edge connect you to a named neighboring city for trade and garbage deals. Power lines and pipes enable power and water deals. Each endpoint requires a separate connection purchase: road $500, rail $750, highway $1,000, electricity $500, water $500. Types, fees and infrastructure checks live in `CONNECTION_TYPES` in `src/sim/neighbor-links.js`. Version 8 saves preserve utility connections from older cities without retroactive fees. Employment is local; connections do not add jobs.
- **Rewards** unlock at population milestones (Mayor's House, City Hall, Courthouse, Stadium, Statue). **Petitioners** offer business deals with strings attached. **Landmarks** can be bought outright.
- **Disasters**: fire, earthquake, tornado, flood, riot, toxic cloud, flying saucer and volcano, triggered or random, with fire crews to dispatch. Active hazards and their remaining duration survive saves.
- **Data maps** for power, water, land value, pollution, crime, traffic, transit and service coverage; a report with eight history graphs; seven advisors with portraits; a news ticker.
- **Scenarios**: open play, grow to 20,000, Boomtown, rescue a failing town, clear the air of a factory town, rebuild after a quake. Start years from 1900 gate technology.
- **Saves**: three browser slots, an autosave every January, plus export and import as a file. Cities are stored in IndexedDB where the browser offers it, falling back to localStorage where it does not: a developed 128×128 city is about 1.1 MB of JSON, which UTF-16 localStorage would double against a ~5 MB origin quota, so the fallback holds small cities only and says so rather than losing one. The game asks for persistent storage on the first save, carries cities over from the older localStorage keys on first run, and reports every failed write instead of losing the city silently.
- **When it breaks**: `frame()` reschedules itself on its last line, so a throw inside the render loop ends it and freezes the picture with no explanation. An uncaught error or rejected promise now stops the clock, writes the city to a rescue slot, and opens a dialog that names the error and offers the city as a file. Only the first crash is shown; the rest are counted. Artwork that fails to decode is not treated as a crash.
- **Save format**: `SAVE_VERSION` in `src/sim/city.js` names the current format, and `MIGRATIONS` beside it is the ordered list of steps that carries an older save to it, one version at a time. Raising the version means appending a step, never editing the earlier ones. `OLDEST_SUPPORTED_SAVE` is the first version with a step. A save that is too old, too new, or unreadable is offered back to the player as a file download rather than discarded. `tests/save-migration.test.js` checks the chain has no gaps by walking a live city back to every supported version and loading it again.

## Controls

| Key / Action | Effect |
|---|---|
| Arrow keys or W A S D | Pan |
| Scroll wheel, `+`, `-` | Zoom |
| `[` `]` | Rotate the view |
| `H` | Center on the city |
| Right-click, middle-click or Space + drag | Pan |
| Click | Place a building (large ones center on the cursor) |
| Drag | Zone an area or draw a road, rail, power line or pipe |
| `Escape` | Cancel a drag, then switch to the query tool |
| `Ctrl`/`Cmd` + `Z` | Undo the last construction |
| `0` `1` `2` `3` | Pause, normal, fast, fastest |

Tool shortcuts are shown in the tooltips of the tool dock.

The build dock sits along the bottom of the city. Open a category to see building
previews and prices, then select a card to build. The selected-tool panel shows
placement instructions and zone density. On phones, use **Build city** to open
the dock. **Data maps** opens coverage and city-condition overlays beside the
camera controls.

The city summary keeps money and population in numbers. Mood and demand use
plain words and colour bars. **Report** shows the city's health through visual
signals; open **Watch your city change** for history. Inspect a place to see its
service connections and urgent problems, then expand **More about this place**
for details. The agent API keeps exact simulation values. Signal bands live in
`src/ui-signals.js`; they only affect presentation. Longer quality bars indicate
better conditions. Neutral traits, such as age mix and local appeal, use words.
Demand bars still distinguish growth from oversupply. Click or tap the news
strip to read the full city news log.

The interface bundles [Nunito Sans](https://github.com/google/fonts/tree/main/ofl/nunitosans)
under the SIL Open Font License, included in `public/fonts/OFL.txt`.

**City menu** contains saving, loading, new cities, sound, day/night and help.
Budget opens with a financial overview; its tabs separate taxes and service
funding, the ledger, policies and neighbor deals. The interface respects the
system's reduced-motion preference. `pnpm test:ui` saves desktop, palette,
budget, welcome and mobile screenshots in `artifacts/`.

## Project layout

- `src/sim/` — the simulation: `catalog.js` (buildings), `terrain.js`, `lots.js`, `place.js`, `utilities.js`, `services.js`, `traffic.js`, `growth.js`, `economy.js`, `events.js`, `neighbors.js`, `disasters.js`, `index.js` (public API)
- `src/construction.js` — plan, apply and undo player actions
- `src/renderer.js`, `src/building-art.js` — isometric renderer, baked building sprites and procedural fallbacks
- `src/street-art.js`, `src/foliage.js`, `src/architecture-cache.js` — street details and bounded artwork caches
- `src/ui.js`, `src/style.css` — the interface
- `src/agent-api.js` — the `civic.agent` command surface, an adapter over the same paths the mouse drives
- `src/save-store.js` — where saved cities live: IndexedDB, with a localStorage fallback and a refusal that reports itself
- `src/crash-guard.js` — the uncaught error and rejected promise handler behind the "The game stopped" dialog
- `src/service-worker-client.js`, `public/sw.js` — offline play, and a new build that waits to be accepted
- `src/main.js` — game loop, saves, wiring

City Builder 3000 is an original work. No copyrighted assets are used. See
[License](#license).

Ground shadows (trees, lots, aircraft and UFOs) and streetlight glow are clipped to the map's
terrain boundary in every camera orientation. Raised artwork can overhang it.
Run `node tests/ground-effects.mjs` against the dev server on port 4173 to check
this distinction in a real Canvas renderer.

Roads and rails support level crossings in either construction order. Every
highway tile is a viaduct on piers, so a highway crosses either route on dry
land in either order and the street keeps running underneath. Bridges cannot
cross. Crossings preserve both traffic networks and maintenance costs; stations
and ramps remain the places to change networks. An on-ramp needs a highway on
one side and a road on the opposite side: it climbs from the road at its foot
to the deck at its head, and traffic uses it only along that axis
(`src/sim/highways.js`). A tile carries at most two routes, and demolishing a
crossing removes the road/deck first, leaving its underlying route. Pipes and
subways can coexist with surface crossings. `tests/crossings.test.js` and
`tests/highways.test.js` cover construction, saves, route continuity, ramp
direction, network separation and underground utilities.

The renderer keeps two cached layers. The ground cache holds only surfaces on
the terrain mesh; everything raised (buildings with their graded sites, decks,
ramps, tunnel mouths, trees, lamps, pylons) is a scene item painted afterwards
in footprint order. `src/scene-items.js` states the rule; `pnpm test:foundations`
and `pnpm test:bridges` check it in a real browser. Every tile's ground is one
fan of triangles on the mesh, split by the water level into wet and dry pieces
and the dry pieces by the sand field (`src/terrain-contours.js`), so the
waterline, the bank and the beach contour are cut from the same surface and
meet exactly; `pnpm test:coastlines` reads the pixels back.

Rail bends draw continuous curves with aligned sleepers and train movement.
Dead ends, T junctions and four-way junctions use only their connected arms;
road crossings and highway underpasses participate in the same rail geometry.

County transport links are explicit purchases: $500 for a road, $750 for rail,
$1,000 for a highway, per endpoint and county. After drawing to the border,
accept the connection offer or keep a dead end. Click an existing endpoint with
its transport tool to reconsider. Purchased links get an outward arrow/sign,
open neighbor trade and road jobs, survive saves, and disappear when their route
is removed. Other purchased links to that county remain active. Existing links
in older saves and the starter town are retained. Utility connections retain
their existing edge behavior.

The agent API returns `connectionOffers` from border builds. Call
`connections()` to list established links and offers, then explicitly purchase
one with `connectNeighbor(x, y, side, route)`. Construction and connection
purchases have separate undo steps. Browser regression: `node tests/neighbor-links.mjs`.

Surface water uses a finite-volume hydrostatic model on a closed map. Terrain
height is the bed; `waterLevel` is a separate horizontal surface. Pools fill,
spill across terrain saddles, and merge or split as earthworks change their
basins. Raising/lowering land conserves water; Create Water excavates and adds
water, while Make Land pumps out and reclaims the selected tile. Terrain can be
lowered to -8. Earthworks that would flood occupied land are refused before
money or terrain changes. Saltwater mixing marks the receiving pool as saline. Water shallower than 0.1
terrain levels remains a stored surface film without converting land or
removing trees. Construction previews include changes to neighboring pools.

The solver uses a simplified depression hierarchy inspired by
[Fill–Spill–Merge](https://doi.org/10.5194/esurf-9-105-2021). It settles after
terrain construction, with no waves, momentum, rain, evaporation or off-map
water exchange. Existing water rows migrate to separate bed/surface heights.
Run `node tests/surface-water.mjs` for browser surface/picking checks.

Coastlines follow the intersection of a terrain mesh and each pool's horizontal
water level. A tile can show both exposed ground and water, with diagonal
contours instead of square bank walls. The mesh uses shared bed vertices and
the gentler diagonal. Pits retain a low bed center, and shared channel edges
retain bed samples so narrow waterways stay connected beneath raised banks.
Dry banks keep their interpolated terrain.
Only components connected to a neighboring pool receive its water level.
This follows the contour-interpolation approach described in
[Marching Squares](https://prideout.net/marching-squares/), using triangles to
give each saddle a defined surface.

This is a visual hybrid over the existing simulation grid. Water-classified
tiles remain water for roads, bridges and building rules, including exposed
corners. Land-classified bank tiles can show a submerged toe and retain their
existing grading and placement rules. The water solver and save format are
unchanged. Picking, shadows, ripples, natural trees and the map-edge skirt use
the same surface geometry. `pnpm test:coastlines` checks corner cases, separate
pools, mesh seams, and wet/dry pixels and picking in all four rotations.

Road, rail and highway drags across water now quote a complete straight bridge
between dry banks at the same elevation. Cross one continuous stretch of water
per drag; use separate drags for separate streams or islands. A span may cover
at most 16 water tiles; clear the site first. Beam spans (1–4 tiles), trusses (5–10) and suspension
spans (11–16) have different artwork. Dry approach tiles slope between the level
span and the adjoining road or track. Cost is the route's tile price multiplied
by `length + 2 + 2 × length²`, including both approaches. Bridges cannot cross
other bridges or tunnels, turn, or accept side connections.

Bridge decks and frames share the scene order used by buildings and trees.
Foreground terrain clips their silhouettes. A cached visibility mask lets
traffic move above the deck while nearer buildings and trusses cover it.
`pnpm test:bridges` checks overlap pixels, picking and traffic in all four views.

The Road Tunnel and Rail Tunnel tools find level portals across at least six
tiles of higher ground. There is no tunnel length cap beyond the map itself.
Tunnel cost is the tool's bore price times length, plus the route's tile price
times length squared. Bores cannot cross other bores or subways; surface roads
may run over sufficiently high ground without joining the tunnel. Traffic enters
only through the portals. These straight, level structures and their quotes are
inspired by [OpenTTD's construction rules](https://wiki.openttd.org/en/Manual/Bridges).

Accept the construction dialog to build a bridge or tunnel; Cancel or Escape
leaves the whole selection and treasury untouched. Quotes are checked again on
acceptance. Bulldozing a bridge tile or a tunnel entrance removes the complete
structure; roads and buildings above a tunnel remain. Save/load and undo preserve
these structures. Old straight bores acquire portal connections when loaded.
The agent `build()` API returns `requiresConfirmation` and `quote`; repeat the
same call with `{confirmStructures: true, maxCost: quote}` as the sixth argument
to accept. `query()` includes the structure's route and both entrances.

Power lines occupy empty surface tiles. Roads, rail, highways, ramps, zoning,
planted trees and building footprints remove pylons automatically as part of
construction. A power-line drag skips occupied surfaces and charges only for
eligible tiles; laying a line clears vegetation, like laying a road. Pipes,
subways and buried bores occupy a separate underground layer. Buildings and
zones conduct electricity, and power still jumps a single road or rail tile.
Bridges include cabling across the complete span, including legacy bridges
whose visible pylons are removed during load.
Older saves remove pylons embedded in roads or buildings when loaded. Starter
town wiring now follows those same network rules instead of running pylons
along streets.

### Building sites and slopes

Developed lots keep a flat grade. The terrain mesh meets that grade along the
lot perimeter, so adjoining roads and open ground do not dip underneath a
floating slab. Adjacent lots at different heights form terraces: the lower
site owns the shared ground edge and the higher site has a retaining wall.
Walls follow every terrain vertex, including coastlines and long footprints.
The full foundation shell stays closed at far corners when the view rotates.
Foundations hide objects behind them, and footprint-based drawing order keeps
trees beside the near edge in front. This presentation applies to both sprite and
procedural buildings and does not change saved elevations or earthwork prices.
Catalog buildings still auto-level modest slopes within their existing quote;
steep sites require leveling, and zoning develops only level footprints.

Checks: `pnpm test:foundations` (against the running development server), including
terraced corner support and tree overlap at all four rotations.

### Construction sites

Zoned buildings use a separate construction site during their existing first
month: exposed floor slabs and columns, materials, and a braced crane. Each
site uses one of four orientations, fixed by its saved location and variant.
The crane side and heading stay consistent when the camera rotates. The
finished sprite appears when that construction state ends. Abandoned sites
do not show cranes. Check `pnpm test:construction-art` against the development
server.

### Sunlight and shadows

The sun stays fixed in the world when the view rotates. Buildings and trees
cast onto terrain, paved sites and neighboring artwork; lower receivers use
their own roof and wall heights. Imported artwork is baked with the same world
light. Shadow volumes use simplified bodies and exact artwork alpha clipping,
with cached intersections, bounded scratch canvases and a shared 16 MiB
composite atlas for smooth panning. See [SHADOWS.md](SHADOWS.md)
for the research, rendering contract, fidelity limits and validation.

## License

MIT. See [LICENSE](LICENSE). That covers the code and the artwork alike: the sprites under
`public/assets/civic` are rendered from original Blender models, so there is nothing in them
that somebody else owns.

One exception, and it is not mine to relicense. The bundled typeface is Nunito Sans, under the
SIL Open Font License, and `public/fonts/OFL.txt` travels with it in the build. Keep that file
next to the font if you redistribute it.
