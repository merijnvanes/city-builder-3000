# Water architecture

Four original scripted Blender water buildings, exported as 48 transparent WebP
sprites: four rotations × day, powered night and unpowered night. Existing civic
and power exports are preserved. No simulation rules or runtime renderer change.

| Type | Lot | Identity |
| --- | --- | --- |
| waterpump | 1×1 | Copper-roofed brick wet-well house with paired pumps, valves and buried intake stubs |
| watertower | 1×1 | Teal elevated tank on four splayed columns with crossed ties, riser and access ladder |
| desalination | 3×3 | White membrane vessels in open racks, teal intake filters, storage tank and clerestory hall |
| treatment | 3×3 | Two open clarifiers with drive bridges, baffled aeration channels and brick blower house |

The process layouts are stylized miniature architecture. Pipes terminate within
the lots; adjacency and water source rules remain controlled by the simulation.
Night illumination uses the existing powered material mechanism.

## Reproduce and inspect

The authored source is `tools/civic_art/water.py`, using the existing architectural
and industrial primitives. The shared `registry.json` records labels, descriptions,
family and footprints. Render and package family selectors derive from this registry.

Run `npm run art:water` to bake all 48 frames at 32 samples and package the complete
family. For previews use a separate output directory:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types water --states day --rotations 0 --samples 24 \
  --output artifacts/water-preview
```

Open `/civic-gallery.html?family=water` to inspect the production images at game
size and close up. All three collections link to one another.

```sh
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:water
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:civic
CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:power
npm test
npm run build
```

The shared utility sprite lifecycle test exercises actual water frames, one-blit
rendering, opaque silhouette picking, transparent click-through, all lighting
states, portraits and the unchanged 32 MiB decoded cache limit. Catalog coverage
uses both `waterOut` and `cleansWater`, including the treatment plant.

## Validation snapshot · 2026-09-07

- The Node suite passed 301 tests while its manifest check preceded packaging;
  that remaining test passed in the post-export civic checks (302 tests covered).
- All 48 water frames passed actual runtime selection, one-blit drawing, alpha
  picking, distinct-state and portrait checks. Water lifecycle peak decoded
  memory was 20,944,056 bytes; the combined civic lifecycle check reached
  32,884,496 bytes within the unchanged 33,554,432-byte limit.
- Civic and power lifecycle and gallery checks passed, including all 96 power
  frames. All 240 prior frame records and other catalog metadata are identical
  to the preceding commit; no prior images were replaced.
- The full exported water set uses 595,498 bytes. All 288 sprites use 5,854,090
  bytes (5.58 MiB), below the unchanged 6 MiB compressed limit. One daylight view
  of all 24 types decodes to 21,481,960 bytes (20.49 MiB), versus 18.72 MiB before.
- Inspected every water angle in daylight, powered night and unpowered night,
  both gallery scales, and a temporary district beside the sample town in all
  rotations. Lot alignment, rear elevations and elevated silhouettes checked.
- 640 cached/direct architecture comparisons, disaster rendering, gameplay
  browser smoke, default production build and `/nested/` build passed. The
  nested deployment loaded the sample game and all 48 water gallery images.
- Local Chrome frame intervals remained 16.7–16.8 ms p95, matching the prior
  power snapshot. Cached CPU p95 was 1.3–3.7 ms and camera redraw p95 23.8–39.1 ms.
  Concurrent CPU-heavy simulation tests were running, so these wall-clock values
  are not an isolated regression comparison; the runtime drawing code is unchanged.

The initial manifest check ran before packaging and correctly rejected missing
water entries. The post-export manifest and lifecycle checks passed. Likewise,
the packager rejected an early command typo in the unpowered state; the corrected
release command completed a fresh full bake before exporting.

Independent integration review: Gemini, substituted after the installed Claude
CLI rejected the consult skill's `--effort` option, found no blocking defects.
The reviewer also completed a fresh post-export `npm test`: all 302 tests across
68 suites passed. Its optional observations concern the already documented test
URL override and the historical shared `power-sprites.mjs` filename. Byte counts
above are measured directly from the final catalog's files.
