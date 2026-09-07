# Production building assets

## Approved direction

The twelve civic buildings are the approved visual reference for all remaining
buildings. Inspect the actual shipped sprites in `/civic-gallery.html`, at game
size and close up, before designing another family. See [CIVIC-ART.md](CIVIC-ART.md)
for the completed set, renderer integration and measured validation baseline;
[source-art/civic/README.md](source-art/civic/README.md) defines materials and
reproducible export commands.

The first attempt merely embellished the procedural prototype and was rejected.
The accepted work uses original scripted Blender models, rendered offline to
transparent WebP. The browser remains Canvas 2D with no runtime 3D dependency.
The rest of the prototype must rise to this standard, rather than constrain it.

Recognition must survive without a label: silhouette, roof form, entrances,
structural rhythm and purposeful grounds establish use. Design distinct buildings,
not a universal box with a different sign. Use recessed windows, convincing roof
and wall junctions, restrained materials, bevels and contact shadows. Concentrate
small detail where it reads at city zoom. Quiet surfaces are as valuable as detail.

Vehicles are optional, not a checklist. The civic collection intentionally has
none. Tiny block cars were specifically rejected. Likewise, do not repeat a
fountain, parking lot, tree arrangement or rooftop icon across every asset.
Repeated neighborhoods need meaningful architectural variants, not just recolors.
Keep a coherent material and lighting language without making everything a civic
monument: houses should feel domestic and industrial plants should reveal process.

## Remaining inventory

This is a migration checklist from `src/sim/catalog.js` on the civic-art branch.
Reconcile it with the current catalog and rendering dispatch before implementing;
another agent is developing the simulation on `main`. Power is complete; other rows remain to do.
The twelve catalog entries in group `civic` are also done; similarly named
rewards and landmarks are separate assets.

| Family | Remaining assets / coverage |
| --- | --- |
| Residential zones | All three densities, development levels 1–4, supported lot sizes and deterministic architectural variants |
| Commercial zones | All three densities, levels 1–4, supported lot sizes and variants, including tower families |
| Industrial zones | All three densities, levels 1–4 and variants; preserve both 3×3 low-density farms and 1×1 workshops |
| Power | Complete: `coal`, `oil`, `gas`, `nuclear`, `wind`, `solar`, `microwave`, `fusion`; see [POWER-ART.md](POWER-ART.md) |
| Water | `waterpump`, `watertower`, `desalination`, `treatment` |
| Transport buildings | `bus`, `railstation`, `substation`, `airport` (6×5), `seaport` |
| Parks | `park`, `largepark`, `zoo` |
| Rewards | `mayorhouse`, `cityhall`, `courthouse`, `stadium`, `statue`, `marina`, `university`, `medcenter` |
| Landmarks | `clocktower`, `operahouse`, `observatory`, `cathedral`, `aquarium` |
| Business deals | `prison`, `casino`, `toxicdump`, `armybase`, `gigamall` |

Roads, rail, highways, ramps, tunnel portals, networks, trees, terrain and emergency
crews are related environment assets, not interchangeable standalone buildings.
Audit them at the end for visual compatibility and record remaining work explicitly;
do not silently count these tools as migrated buildings or replace network logic.

Suggested order: finish water; transport (including rectangular lots); parks,
rewards and landmarks; then zoned neighborhoods as complete families. A residential
pilot earlier can establish the everyday city palette. This order is a working
recommendation, not a restriction; finish and validate each chosen slice before
committing and pushing it.

## Pipeline extension requirements

The `tools/civic_art/registry.json` registry covers twelve civic and eight power
assets. The shared export, loader and gallery support these square lots (1×1,
2×2, 3×3 and 4×4). New families still need explicit coverage and contract checks. Share primitives and export machinery;
keep authored models in small family modules. Avoid a second divergent renderer
or a giant switch containing every model. Preserve existing civic exports during
incremental migration.

- Generalize square `tiles` metadata and the exact-square loader check to explicit
  footprint width/height. The airport is 6×5. Validate placement and picking in all
  rotations; do not stretch a square sprite to fit.
- Zone selection must account for type, density, level, footprint and deterministic
  variant. Read `src/sim/lots.js`, `src/sim/growth.js`, `src/building-art.js` and
  `src/architecture-cache.js` for actual state semantics before choosing keys.
  Preserve abandonment, undeveloped lots and any construction or disaster overlays.
  A single beautiful house is not complete residential coverage.
- Define a finite variant set and render matrix before baking. Avoid multiplying
  every cosmetic detail into another downloaded/decoded frame. Show development
  through architecture, while retaining stable visual identity across redraws.
- Keep on-demand loading, shared decoded frames and bounded memory. Current civic
  assets use a 32 MiB decoded LRU, active-view preference and one blit per lot.
  Re-measure working sets as the catalog grows; do not preload all types, angles
  and lighting states or create a canvas for every building instance.
- Keep async redraw and portrait refresh, fallback cleanup, failed-load fallback,
  alpha picking, device-pixel snapping and subdirectory-safe asset URLs. Expand the
  loader/manifest tests alongside the new contract, not by weakening civic checks.
- The baked key light is upper-left in screen space. Renderer shadows for new
  assets must agree in all rotations; old procedural lighting is transitional.

One tile is four model units. Model X maps to game X and model Y to negative game
Y. `render.py` uses an orthographic camera at 30° elevation, azimuth -45° plus
90° per rotation, matching a 64×32 pixel ground tile at game zoom 1. Current bakes
use scale 3. Power framing is measured across all four camera views; civic
framing is preserved to keep existing exports stable. Preserve exact projection, measured world-origin screen anchors,
alpha-crop anchor adjustment and measured heights for culling/shadows. Derive
framing from bounds for larger/taller new models; do not guess placement offsets
or assume the existing square render padding fits skyscrapers.

## Author, inspect, ship

1. Write a brief identity for each asset in the slice: silhouette, materials,
   entrance, grounds and how it differs from its neighbors. Check it against the
   approved civic collection and real architectural logic.
2. Model the main volumes first. Render a daylight preview and inspect it at
   actual game size before spending time on details. Inspect rear elevations too.
3. Refine materials, openings, roof junctions and purposeful context. Check for
   floating parts, intersections, z-fighting, noisy textures and illegible props.
4. Bake four angles and day / powered night / unpowered night. Lights must convey
   occupancy appropriately; a power failure must not leave powered windows lit.
5. Package only after the complete render finishes. Commit original model scripts,
   exported WebP and generated metadata together. Optional `.blend` inspection
   files are not the source of truth; raw renders belong in ignored `artifacts/`.
6. Inspect the exported gallery and a real mixed neighborhood in the game, both
   normal zoom and close up, every rotation and lighting state. Check tall-building
   occlusion, lot edges, ground alignment and portrait framing. Fix visual defects
   even when automated tests pass.
7. Run relevant asset/renderer checks and build. For shared runtime changes, run
   the simulation suite, browser smoke, visual comparisons, performance benchmark
   and a production build served under a nested path. Compare memory, download
   size and redraw costs with the baseline in `CIVIC-ART.md`.
8. Get an independent review for non-trivial integration changes (the `consult`
   skill is suitable), resolve findings, update coverage/validation documentation,
   then commit and push the completed slice. Continue autonomously with the next.

For previews, use a separate output directory, for example:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types fire --states day --rotations 0 --samples 24 \
  --output artifacts/civic-preview
```

A partial render replaces that type's render metadata even if old PNGs remain.
Do not preview into the complete-bake directory and then package incomplete
metadata. Never package concurrently with renders writing that same directory.
Use the full twelve-frame per-type command in the source README for release.
Incremental packaging needs the existing complete exported catalog, which is
tracked; full packaging needs a full bake of all registered families. Update these commands when generalizing
beyond civic assets, and keep the documented workflow executable.

## Working alongside simulation development

Use an isolated art worktree/branch. Inspect local instructions, status and
worktrees first. Read current `main` changes before integration, especially catalog
footprints and renderer contracts. Do not switch, reset or clean the other agent's
worktree, change game balance for aesthetic convenience, or overwrite their work.
Do not assume the art branch has already been merged.

The user explicitly requests commits and pushes after every completed step.
Include all intended source, assets, generated metadata and docs; inspect unexpected
uncommitted files before including them. Keep ignored render intermediates out of
Git. Verify clean status and the remote branch after pushing. A session handoff
should state completed coverage, remaining work, branch/worktree and any blockers,
and link this guide instead of reproducing it.
