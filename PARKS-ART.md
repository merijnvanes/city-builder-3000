# Parks architecture

The Parks & Land menu contains three standalone leisure lots: Small Park (1×1),
Large Park (3×3), and Zoo (4×4). Terrain tools and planted tree overlays are not
building sprites. Rewards such as Stadium and Marina, and landmark attractions,
remain separate future families.

| Type | Identity |
| --- | --- |
| park | Shaded pocket garden, crossing gravel paths, timber bench and flower borders |
| largepark | Copper octagonal bandstand, lily pond, rose pergola and open lawns |
| zoo | Brick entrance lodges, airy aviary, elephant and giraffe yards, penguin pool |

Original Blender models live in `tools/civic_art/parks.py`. Architecture and
landscaping use the existing material palette and offline lighting. Animals are
small authored static sculptures, consistent with the fixed-pose sprite pipeline.
Path intersections use non-overlapping surfaces. The small park paths meet all
four edges for repeated painted park tiles. This slice has one authored layout
per type; the old procedural small-park fallback has three layouts and remains
available while sprites load. Additional authored park variants remain future work.

The registry preserves gameplay lot sizes and rules. The runtime still uses one
shared decoded sprite cache, on-demand loading, one draw per lot and a 32 MiB cap.
No simulation or runtime renderer code changes are required for this family.

## Export and inspect

Run `npm run art:parks` for all 36 frames (four rotations × daylight, powered
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
budget stays at 6 MiB; the 36 new park frames have a separate 0.75 MiB ceiling.

## Validation snapshot · 2026-09-07

- All 36 park frames passed actual runtime drawing, single-blit reuse, alpha
  picking, transparent click-through, portrait bounds and distinct lighting/state
  checks. Peak decoded bytes in the parks lifecycle run: 25,260,192.
- Civic, power and water lifecycle/gallery regression checks passed. The combined
  civic lifecycle check reached 32,999,696 bytes within the 33,554,432-byte cap.
  All 288 prior frame records, file references and metadata are unchanged.
- The 36 park sprites total 618,912 bytes (0.59 MiB), below their measured-family
  0.75 MiB ceiling. All 324 images total 6,473,002 bytes (6.17 MiB). The original
  families remain at 5.58 MiB under their unchanged 6 MiB guard.
- One daylight frame of all 27 types decodes to 23,625,496 bytes (22.53 MiB), up
  from 20.49 MiB for 24 types, still within the shared decoded limit.
- Rendering unit and manifest checks passed, as did 640 direct/cached architecture
  comparisons, disaster rendering and the gameplay browser smoke test.
- Default and `/nested/` production builds passed. The nested host loaded the
  sample town and every one of the 36 park gallery images through relative URLs.
- Visually inspected every exported rotation and lighting state, the gallery at
  both scales, and the real game in all rotations by day and night, including
  a contiguous 3×3 block of small park tiles. The repeated authored layout is
  intentionally visible; extra layout variants are not part of this slice.

All simulation and runtime rendering sources are unchanged. The full simulation
suite was not repeated for this art-only slice; gameplay smoke and renderer
regressions cover the integration, with the prior water commit's full 302-test
run as the simulation baseline.

Independent review: Gemini found no blocking integration defects. It verified
family predicates, preserved exports, geometry bounds, runtime compatibility and
browser checks. Its test-port advisory is covered by the commands above. The
final park-family budget was tightened from the review's initial 1.25 MiB to
0.75 MiB after measuring the complete export; the stricter manifest test passed.
