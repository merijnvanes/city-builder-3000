# City Builder 3000

A browser city builder in the spirit of the classic isometric city games. Vanilla JS, Canvas 2D, no runtime dependencies, no external assets. All art is procedural and original.

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
- `src/renderer.js`, `src/building-art.js` — isometric renderer and procedural architecture
- `src/street-art.js`, `src/foliage.js`, `src/architecture-cache.js` — street details and bounded artwork caches
- `src/ui.js`, `src/style.css` — the interface
- `src/main.js` — game loop, saves, wiring

City Builder 3000 is an original work. No copyrighted assets are used.
