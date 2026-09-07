# Parks architecture

The Parks & Land menu contains three standalone leisure lots: Small Park (1×1),
Large Park (3×3), and Zoo (4×4). Terrain tools and planted tree overlays are not
building sprites. Rewards such as Stadium and Marina, and landmark attractions, are separate
completed families; see [REWARDS-ART.md](REWARDS-ART.md) and
[LANDMARKS-ART.md](LANDMARKS-ART.md).

| Type | Identity |
| --- | --- |
| park | Three layouts: fountain garden, gazebo garden, and a playground with swing and slide |
| largepark | Copper octagonal bandstand, lily pond, rose pergola and open lawns |
| zoo | Brick entrance lodges, airy aviary, elephant and giraffe yards, penguin pool |

Original Blender models live in `tools/civic_art/parks.py`. Architecture and
landscaping use the existing material palette and offline lighting. Animals are
small authored static sculptures, consistent with the fixed-pose sprite pipeline.
Path intersections use non-overlapping surfaces. The three small parks preserve
the original procedural layout identities and selection: `floor(seed * 3)`, with
`tile.variant` as the normalized seed, falling back to the original coordinate
hash when absent. The saved seed is not a discrete model index. Rotation, lighting,
redraws and saved tile roundtrips do not change which layout is selected.

`src/architecture-variation.js` shares the original coordinate hash with procedural
architecture and resolves sprite variant keys. Existing single-layout frames retain
`day-0`-style keys; additional layouts use `day-0-v1` and `day-0-v2`. The registry
lists each layout's model and gallery description. Render metadata accumulates all
variants with a conservative maximum height; packaging requires all 36 small-park
frames before replacing the type. Other types still require their original 12.

Normal rendering requests only the selected layout through the shared 32 MiB cache.
Instances of the same layout share one decoded image, and cold-load completion
refreshes fallback art and portraits. The explicit preload helper can take a discrete
`variant` index; single-layout types in mixed requests always use layout zero.
Omission preloads all layouts of the requested types for inspection.
Gameplay balance, lot sizes and save data are unchanged.

## Export and inspect

Run `npm run art:parks` for all 60 frames (five layouts × four rotations × daylight, powered
night, unpowered night) and incremental packaging. Preview in a separate directory:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types parks --states day --rotations 0 --samples 24 \
  --output artifacts/parks-preview
```

Open `/civic-gallery.html?family=parks` for game-size and close-up views. Gallery
navigation links all four completed families. Run checks against the art server:

```sh
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:parks
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:civic
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:power
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:water
npm run build
```

The shared browser checks select expected types from gameplay catalog predicates
in `tests/art-families.mjs`, rather than assuming registry membership proves
coverage. They check all frame selections, single blits, picking, portraits,
lighting differences and cache limits. The original civic/power/water compressed
budget stays at 6 MiB; the 60 park frames have a separate 0.75 MiB ceiling.

## Validation snapshot · 2026-09-07 · restored small-park variants

- All 305 Node tests passed, including original seed boundaries, coordinate fallback
  and saved seed precedence. All 60 park-family frames passed actual sprite drawing,
  distinct-layout/state hashes, alpha picking, portrait framing and single-blit checks.
- A separate cold-load check verifies one requested layout, fallback release,
  redraw notification and 150 instances of each layout sharing exactly three
  decoded canvases. Those three daylight images total 306,528 decoded bytes.
- Civic, power and water lifecycle/gallery regressions passed. All 312 frames and
  metadata for types other than the small park are unchanged from the first parks
  commit. The total catalog is now 27 types, 29 layouts and 348 frames.
- Parks use 739,070 bytes (0.705 MiB), still under the existing 0.75 MiB family cap.
  All assets use 6,593,160 bytes (6.29 MiB). The unchanged earlier families remain
  within their original 6 MiB budget.
- One daylight frame of every layout decodes to 23,826,376 bytes (22.72 MiB).
  Park lifecycle peak was 27,592,632 bytes, below the unchanged 32 MiB limit.

The first parks commit inadvertently replaced the three procedural small-park
layouts with one authored garden. This correction restores all three identities
in the production sprites and gallery, and adds explicit variant coverage to the
export and test contracts.

Additional verification: 640 direct/cached rendering comparisons, disaster
rendering, gameplay smoke, default build and `/nested/` production deployment
passed. The nested gallery loaded all 60 park-family frames. An intentionally
incomplete 35-frame park bake was rejected before changing the exported catalog.
All small-park variants were inspected across every view and lighting state,
and the real sample-town inspection block now shows the original mixed layouts.
Local performance p95: 16.7–16.8 ms browser frame intervals, 0.6–0.9 ms cached
CPU and 11–20 ms camera redraw, within the range of earlier local snapshots.

Independent review: Gemini found no blocking issues. Both optional suggestions
were addressed: mixed explicit-variant preloads include single-layout types, and
the browser harness now checks coordinate-only parks against the original hash.
Targeted parks/civic checks and the production build passed after those changes.

Bench placement correction: all three small-park layouts now place the outdoor
bench on a recessed seating pad, facing the walk with its full footprint clear
of the through-path. Nearby flowers/trees were shifted to preserve seating space.
All 36 small-park frames were rebaked and inspected in all four views. Parks
lifecycle checks (60 frames), manifest validation and the production build passed;
all other building exports remain unchanged.
