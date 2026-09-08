# Power architecture

All eight power buildings use original scripted Blender architecture, baked to
transparent WebP: four camera angles × daylight / powered night / unpowered night.
The approved twelve civic models and their image files are preserved.

| Type | Architectural identity |
| --- | --- |
| Coal | Brick turbine house, tall boiler block, twin masonry flues, coal bunker and inclined conveyor |
| Oil | Ochre generating hall, single metal stack, two bunded fuel tanks and transfer pipework |
| Gas | Parallel blue turbine enclosures, intake louvers, thin exhaust stacks and finned air cooler |
| Nuclear | Two hollow waisted cooling towers, domed containment and separate turbine hall |
| Wind | Tapered mast, sculpted three-blade rotor and compact electrical cabinet on a 1×1 lot |
| Solar | Four rows of tilted dark photovoltaic modules, support legs and an inverter service lane |
| Microwave | Speculative satellite-power receiver: concave dish, feed supports and copper rectenna apron |
| Fusion | Speculative annular reactor vessel, raised copper-colored coils and glazed control gallery |

Wind blades are baked in a fixed pose, consistent with the shared static-building
renderer. Future plants are stylized game concepts, not engineering schematics.
Generating equipment and campus layout establish identity without building labels
or repeated vehicles. Equipment and control windows light only in powered night
frames; no new runtime animation or 3D dependency is introduced.

## Author and export

`tools/civic_art/registry.json` is the shared type / footprint / family registry.
Sources are `power_fossil.py`, `power_clean.py`, `power_future.py` and
`power_common.py`. Existing `civic` filenames and the asset URL directory are
retained for compatibility; the loader dispatches all registered buildings through
one decoded-frame cache with the existing 32 MiB limit.

Run `npm run art:power` for a complete eight-type, 96-frame bake and incremental
package. `npm run art:civic` rebuilds the civic family. For an individual plant:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types nuclear --states day,night,unpowered --rotations 0,1,2,3 --samples 32
python3 tools/civic_art/package.py --types nuclear
```

For a preview, use `--states day --rotations 0 --output artifacts/power-preview`.
Never package preview metadata; all twelve frames are required for each selected
type. `--save-blend` writes optional inspection files beside the render outputs.

The new-family camera framing is measured from authored geometry across all four
angles, preserving the 2:1 ground projection and three-pixels-per-game-pixel bake.
Export rejects out-of-lot geometry and clipped images. Width and height remain
square-lot metadata; rectangular lots and zoned variants are still future work.

## Inspect and validate

Open `/civic-gallery.html?family=power` for the production power collection, with
game-size and close-up controls, all rotations, and three lighting states. The
civic gallery links to this collection and back.

With Vite running on port 4191:

```sh
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:civic
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:power
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:visuals
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:browser
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:performance
npm test
npm run build
```

Power-specific browser checks cover all 96 frame selections, single-blit reuse,
alpha picking (including rotor tips), power-state differences, portrait framing,
and the combined civic/power memory budget. Contact sheets live in ignored
`artifacts/`. Validation results follow.

## Validation snapshot · 2026-09-07

- 302 Node tests passed, including complete registry/catalog/footprint coverage.
- Civic lifecycle checks passed with all twenty asset types sharing the cache.
- All 96 power frames passed single-blit, alpha-picking, distinct-state and
  portrait-boundary checks. Peak measured decoded bytes: 33,537,144 of 33,554,432.
- 640 direct/cached rendering comparisons, disaster rendering, and the gameplay
  browser smoke test passed. Default and `/nested/` production builds passed;
  the nested-host check loaded the game and all 96 power gallery images.
- Visually inspected all camera/lighting combinations, the gallery at both
  scales, and a temporary power district beside the sample town. Verified that
  all 144 civic frame records and their heights remain unchanged.

The 96 power images total 2,268,002 bytes (2.16 MiB); all 240 civic/power images
total 5.01 MiB. A complete daylight view of all twenty types decodes to 18.72 MiB.

A local 1440×1000 Chrome comparison against the pre-power commit measured browser
frame intervals around 16.7–16.8 ms in both versions. New cached-frame CPU p95
ranged from 0.6–1.8 ms versus 0.7–1.2 ms before; camera-redraw p95 ranged from
11.8–30.8 ms versus 12.3–20.4 ms. Concurrent simulation jobs made wall-clock
comparisons noisy, particularly the 128×128 night case. These are local snapshots,
not a cross-device performance guarantee. Runtime cache limits are unchanged.

Independent review: Gemini (fallback after Claude's configured model returned
404) reported no blocking findings. Its low-priority metadata duplication and
export-diagnostic suggestions were addressed: both galleries now read labels
and descriptions from the shared registry, and missing incremental catalogs
produce an explicit recovery message.
