# City Builder 3000

A browser city builder inspired by classic isometric games. Vanilla JS, Canvas 2D, no runtime dependencies or external asset downloads. Requires Node.js 20.19+ or 22.12+ for the Vite development tools.

## Quick start

```bash
pnpm install
pnpm dev           # dev server at http://127.0.0.1:5173
```

## Build and deploy

```bash
pnpm build         # outputs to dist/
```

The `dist/` folder is a self-contained static site. Drop it on any static host (Netlify, GitHub Pages, Vercel, Cloudflare Pages). No server-side runtime required.

## Tests

```bash
pnpm test          # node:test runner, no additional setup needed
```

Tests cover city simulation, save validation, placement, camera projection, and zoom anchoring.

With Chrome installed, run `pnpm dev --port 4173` in one terminal and `pnpm test:browser` in another for browser gameplay checks. Screenshots are written to `artifacts/`. Set `CIVIC_TEST_URL` to test another server URL.

## Controls

### Camera

| Key / Action | Effect |
|---|---|
| Arrow keys or W A S D | Pan camera |
| Scroll wheel | Zoom in / out |
| `+` or `=` | Zoom in |
| `-` | Zoom out |
| `H` | Return to home view |
| Middle-click drag | Pan camera |
| Space + drag | Pan camera |
| Right-click drag | Pan camera |
| Touch drag in Inspect mode | Pan camera |
| Two-finger pinch / drag | Zoom / pan camera |

### Speed

| Key | Speed |
|---|---|
| `0` | Pause |
| `1` | Normal |
| `2` | Fast |
| `3` | Fastest |

### Tools

| Key | Action |
|---|---|
| `Escape` | Switch to inspect tool |
| Tool shortcut (shown in palette) | Select that tool |

Tool shortcuts are shown next to each tool in the left palette. Click any tile while a building tool is active to place it. Drag to paint roads or zones continuously. Click while in inspect mode to see tile details.

## Gameplay basics

1. Start with a road grid. Zone residential, commercial, and industrial areas around roads.
2. Connect power plants and water towers to your road network. Lots connect within three tiles of roads; plants serve up to 30 tiles away and powered water towers up to 25. Each plant supplies 1,000 units and each tower 800, so large districts need additional capacity.
3. Newly zoned land starts empty at level 0. With positive demand, road access, power, and water, it develops up to level 4. Buildings gradually decline if disconnected.
4. Balance the budget. Tax income comes from residents and businesses. Services cost money each month.
5. Use the overlay buttons (power, water, land value) to spot coverage gaps.
6. Save your city via the Save button. The city is stored in browser local storage.
7. On small screens, tap **City** to open the budget, service, and overlay dashboard. The bottom tools scroll horizontally.
8. Bulldozing costs $25 and recovers 25% of the original construction cost. Parks and nearby industry affect the land-value overlay; police and fire services contribute to city-wide happiness.

## Scope and limitations

City Builder 3000 is an original prototype, not a SimCity port. Copyrighted assets are not used.

**What it has:**
- Isometric canvas renderer with day/night mode
- 40×40 tile grid with procedural terrain (river, grass, sand)
- Residential, commercial, and industrial zoning with growth levels
- Roads, power, water, parks, police, and fire services
- Monthly simulation with tax income and service expenses
- Overlay maps for power, water, and land value
- Browser local storage save/load
- Keyboard-driven workflow

**What it does not have:**
- Multiple cities or regions
- Disaster events
- Budgets beyond a single tax slider
- Multiplayer
- Save files that persist across browser clearing

The simulation and renderer are simplified compared to commercial city builders. Growth formulas are intentional approximations. Population numbers are indicative, not census-accurate.
