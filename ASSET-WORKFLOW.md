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

## Coverage inventory

This is a migration checklist from `src/sim/catalog.js` on the civic-art branch.
Reconcile it with the current catalog and rendering dispatch before implementing;
another agent is developing the simulation on `main`. All building families listed below are now authored on this branch.
The twelve catalog entries in group `civic` are also done; similarly named
rewards and landmarks are separate assets.

| Family | Assets / coverage |
| --- | --- |
| Residential zones | Complete: all densities, levels 1–4, supported lot sizes and 100 authored layouts; see [RESIDENTIAL-ART.md](RESIDENTIAL-ART.md) |
| Commercial zones | Complete: all densities, levels 1–4, supported footprints and 136 authored layouts; see [COMMERCIAL-ART.md](COMMERCIAL-ART.md) |
| Industrial zones | Complete: all densities, levels 1–4, supported footprints and 152 authored layouts, including 3×3 farms and 1×1 workshops; see [INDUSTRIAL-ART.md](INDUSTRIAL-ART.md) |
| Power | Complete: `coal`, `oil`, `gas`, `nuclear`, `wind`, `solar`, `microwave`, `fusion`; see [POWER-ART.md](POWER-ART.md) |
| Water | Complete: `waterpump`, `watertower`, `desalination`, `treatment`; see [WATER-ART.md](WATER-ART.md) |
| Transport buildings | Complete on this branch: `bus`, `railstation`, `substation`, `airport` (6×5), `seaport`; see [TRANSPORT-ART.md](TRANSPORT-ART.md) for the growing-port integration boundary |
| Parks | Complete: `park` (three layouts), `largepark`, `zoo`; see [PARKS-ART.md](PARKS-ART.md) |
| Rewards | Complete: `mayorhouse`, `cityhall`, `courthouse`, `stadium` (two palettes), `statue`, `marina`, `university`, `medcenter`; see [REWARDS-ART.md](REWARDS-ART.md) |
| Landmarks | Complete: `clocktower`, `operahouse`, `observatory`, `cathedral`, `aquarium`; see [LANDMARKS-ART.md](LANDMARKS-ART.md) |
| Business deals | Complete: `prison`, `casino`, `toxicdump`, `armybase`, `gigamall`; see [DEALS-ART.md](DEALS-ART.md) |

Roads, rail, highways, ramps, tunnel portals, networks, trees, terrain and emergency
crews are related environment assets, not interchangeable standalone buildings.
The end-of-run compatibility audit and follow-up polish are recorded in
[ENVIRONMENT-ART-AUDIT.md](ENVIRONMENT-ART-AUDIT.md);
do not silently count these tools as migrated buildings or replace network logic.

This run followed the authorized order: business deals, landmarks, residential
zones, commercial zones, then industrial zones. Each slice is validated, reviewed,
committed and pushed before the next completed category.

## Pipeline extension requirements

The `tools/civic_art/registry.json` registry covers twelve civic, eight power, four water, three park, five transport, eight reward, five business-deal and five landmark
fixed assets plus 76 residential/commercial/industrial state/footprint entries. The shared export, loader and gallery support legacy square lots (1×1,
2×2, 3×3, 4×4 and 5×5) and explicit rectangular footprint metadata. New families still need explicit coverage and contract checks. Share primitives and export machinery;
keep authored models in small family modules. Avoid a second divergent renderer
or a giant switch containing every model. Preserve existing civic exports during
incremental migration.

- New rectangular assets declare `footprint: {w, h}` in registry, render metadata
  and packaged catalog. Legacy square `tiles` remains supported without rebaking.
  Model bounds are checked independently against width and depth; runtime draws
  only exact footprint matches, centered on the lot with the measured pixel anchor.
  Gallery sizing uses actual frame bounds. Validate new assets in all rotations;
  do not stretch a square sprite to fit.
- Zone registry entries declare `zone: {type, density, level}` alongside the exact
  footprint. `zone-art-key.js` selects the state entry; the normalized seed selects
  its layout. Construction and abandonment overlays share `lot-art-effects.js`.
  Dense zone facades use scoped direct mesh primitives during offline modeling.
- Zone selection must account for type, density, level, footprint and deterministic
  variant. Read `src/sim/lots.js`, `src/sim/growth.js`, `src/building-art.js` and
  `src/architecture-cache.js` for actual state semantics before choosing keys.
  Preserve abandonment, undeveloped lots and any construction or disaster overlays.
  A single beautiful house is not complete residential coverage.
- Preserve existing visual variance when replacing procedural art; audit seed-driven
  layout branches first. Define a finite variant set and render matrix before baking. Avoid multiplying
  every cosmetic detail into another downloaded/decoded frame. Show development
  through architecture, while retaining stable visual identity across redraws.
- Keep on-demand loading, shared decoded frames and bounded memory. Current civic
  assets use a 32 MiB decoded LRU, active-view preference and one blit per lot.
  Re-measure working sets as the catalog grows; do not preload all types, angles
  and lighting states or create a canvas for every building instance. Under
  pressure, surplus active-image resolution can be reduced to the current display
  need; closer views restore full exports asynchronously. See [REWARDS-ART.md](REWARDS-ART.md).
- Keep async redraw and portrait refresh, fallback cleanup, failed-load fallback,
  alpha picking, device-pixel snapping and subdirectory-safe asset URLs. Expand the
  loader/manifest tests alongside the new contract, not by weakening civic checks.
- The key and fill lights stay fixed in world space while the camera rotates.
  `src/sunlight-config.json` is shared by the exporter and runtime shadow volumes.
  Every packaged frame must use the same `world-v1` convention; never mix old
  camera-relative bakes into a rebuilt catalog. See [SHADOWS.md](SHADOWS.md).
  Metal-capable hosts can add `--device METAL` to rendering commands without
  changing sample count, framing or output resolution. The packager accepts
  `--jobs N` to control parallel encoding while retaining the same image quality.

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

## Rectangular contract validation · 2026-09-07

Infrastructure checkpoint: explicit `{w, h}` footprints coexist with unchanged
square exports. All 306 Node tests pass, including a deliberately asymmetric 6×5
fixture across twelve view/lighting combinations, exact-dimension rejection and
Retina anchor rounding. Existing civic lifecycle, portrait refresh, picking,
348-frame nested-path gallery, 640 direct/cached comparisons, disaster rendering,
gameplay smoke and production build pass. Local p95 frame cadence remains
16.7–16.8 ms (cached CPU 0.6–1.1 ms, camera redraw 15.5–22.8 ms).
`python3 tests/civic-package.py` also passes isolated real packaging, alpha-crop
anchor adjustment and footprint mismatch rejection without catalog replacement.
An isolated asymmetric 6×5 Blender fixture also completed all twelve renders and
packaging; its actual exports passed single-blit drawing, all-view alpha picking,
state hashes and portrait framing through the browser runtime (3,313,440 decoded
bytes). Four daylight views were visually inspected. Production models still
require their own geometry and real-game visual checks.

Integration discovery: current `main` has replaced fixed airport/seaport buildings
with port zones that grow to varying rectangles up to 8×8. Do not merge fixed-lot
art into that contract without deliberately covering those sizes and both orientations.
The art branch's gameplay catalog is unchanged by this infrastructure checkpoint.

Independent review: fresh Codex fallback found no blocking issues after the Claude
CLI rejected its effort flag. Its discoverability suggestion is addressed by
`npm run test:art-contract`, covering runtime/manifest checks and real packaging.
