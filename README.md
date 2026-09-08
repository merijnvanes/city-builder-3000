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
```

`dist/` is a self-contained static site. Drop it on any static host.

## Tests

```bash
pnpm test          # node:test unit tests for the simulation, construction and camera
pnpm test:performance # Chrome renderer benchmark against the running dev server
```

With Chrome installed, run `pnpm dev --port 4173` in one terminal and `pnpm test:browser` in another for a scripted gameplay check. Screenshots land in `artifacts/`. Run `pnpm test:visuals` against the same server for Canvas pixel checks of courtyard occlusion and earthquake layering, in all camera orientations and day/night lighting. Set `CIVIC_TEST_URL` to use another server port.

Gameplay fidelity and remaining verified gaps are tracked in [PARITY.md](PARITY.md).

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
- **Transport**: roads and highways with commuting traffic that routes around jams, rail with stations, subways with stations, bus stops, airport and seaport.
- **Budget**: separate R/C/I taxes, six funded departments, eighteen ordinances, amortised loans, a monthly ledger and an annual review every January.
- **Neighbors**: roads, rails, power lines and pipes to the map edge connect you to a named neighboring city for trade, outside jobs and power/water/garbage deals.
- **Rewards** unlock at population milestones (Mayor's House, City Hall, Courthouse, Stadium, Statue). **Petitioners** offer business deals with strings attached. **Landmarks** can be bought outright.
- **Disasters**: fire, earthquake, tornado, flood, riot, toxic cloud, flying saucer and volcano, triggered or random, with fire crews to dispatch. Active hazards and their remaining duration survive saves.
- **Data maps** for power, water, land value, pollution, crime, traffic, transit and service coverage; a report with eight history graphs; seven advisors with portraits; a news ticker.
- **Scenarios**: open play, grow to 20,000, Boomtown, rescue a failing town, clear the air of a factory town, rebuild after a quake. Start years from 1900 gate technology.
- **Saves**: three browser slots, an autosave every January, plus export and import as a file.

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

## Project layout

- `src/sim/` — the simulation: `catalog.js` (buildings), `terrain.js`, `lots.js`, `place.js`, `utilities.js`, `services.js`, `traffic.js`, `growth.js`, `economy.js`, `events.js`, `neighbors.js`, `disasters.js`, `index.js` (public API)
- `src/construction.js` — plan, apply and undo player actions
- `src/renderer.js`, `src/building-art.js` — isometric renderer, baked building sprites and procedural fallbacks
- `src/street-art.js`, `src/foliage.js`, `src/architecture-cache.js` — street details and bounded artwork caches
- `src/ui.js`, `src/style.css` — the interface
- `src/agent-api.js` — the `civic.agent` command surface, an adapter over the same paths the mouse drives
- `src/main.js` — game loop, saves, wiring

City Builder 3000 is an original work. No copyrighted assets are used.

Ground shadows (trees, lots, aircraft and UFOs) and streetlight glow are clipped to the map's
terrain boundary in every camera orientation. Raised artwork can overhang it.
Run `node tests/ground-effects.mjs` against the dev server on port 4173 to check
this distinction in a real Canvas renderer.

Roads and rails support level crossings in either construction order. Highways
can cross either route on dry land on a viaduct in either order. Bridges cannot cross. Crossings preserve both
traffic networks and maintenance costs; stations and ramps remain the places to
change networks. A tile carries at most two routes, and demolishing a crossing
removes the road/deck first, leaving its underlying route. Pipes and subways can
coexist with surface crossings. `tests/crossings.test.js` covers construction,
saves, route continuity, network separation and underground utilities.

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
month: exposed floor slabs and columns, materials, and a braced crane. The
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
