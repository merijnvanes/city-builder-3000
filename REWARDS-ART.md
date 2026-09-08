# Reward architecture

Eight population rewards use original scripted Blender models. They are selected
by the gameplay catalog's `reward` metadata; business deals and landmarks are separate completed families; see
[DEALS-ART.md](DEALS-ART.md) and [LANDMARKS-ART.md](LANDMARKS-ART.md).

| Type | Footprint | Identity |
| --- | --- | --- |
| mayorhouse | 2×2 | Domestic manor, terracotta roof, veranda and private garden |
| cityhall | 3×3 | Limestone hall, square clock tower and copper lantern |
| courthouse | 3×3 | Six-column portico, stone pediment and broad public stair |
| statue | 1×1 | Bronze civic figure on a layered plinth with low uplights |
| stadium | 5×5 | Open seating bowl, striped pitch, entrance aisle and floodlights |
| marina | 3×3 | Clubhouse, dry quayside walk, jetties and sculpted sailing hulls |
| university | 4×4 | Domed rotunda, faculty wings, lecture theatre and reading garden |
| medcenter | 4×4 | Paired laboratories, glazed link, roof plant and northlit research hall |

Sources are `tools/civic_art/reward_government.py`, `reward_campuses.py`, and
`reward_recreation.py`. The university is distinct from the existing clock-tower
college; the research campus is distinct from the hospital's stepped wards and
medical crosses. Stadium palettes preserve the original seed split at 0.5 and
alternating cool or warm seating tones. Nine layouts produce 108 frames.
No gameplay footprints, unlock thresholds, reward uniqueness, siting or balance
change. Marina still requires nearby water.

Circulation was checked in model coordinates and exported views. University paths
meet without coplanar overlaps and connect the faculty doors and raised rotunda
landing. Laboratory entrances reach the courtyard; its planted strips leave a
clear route under the skybridge. The stadium pitch clears the inner bowl, and an
open entrance aisle runs between the ticket kiosks. Marina benches face the basin
from dry pads, its clubhouse has a quayside door, and boats clear the widened quay.

## Export and inspect

Run `npm run art:rewards` for the full bake and incremental packaging. Preview in
a separate output directory, never in the complete-bake directory:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types rewards --states day --rotations 0,2 --samples 16 \
  --output artifacts/rewards-preview
```

Open `/civic-gallery.html?family=rewards` for game-size and close-up views.
Run `CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:rewards` for every runtime
frame, palette/state hash, silhouette pick, portrait and contact sheet.
`npm run test:art-contract` validates catalog coverage and rectangular packaging.
Rewards have a separate 4 MiB compressed ceiling; all earlier family caps remain.

## Expanded shared cache

Full exports remain at scale 3. One daylight layout of every gameplay type now
requires 36,614,580 decoded bytes (34.92 MiB), above the unchanged 32 MiB cache cap.
The loader first evicts inactive frames. Under pressure, active images with surplus
pixels can be reduced to the resolution needed by their current display scale and
DPR, considering all active owners. Anchors and world-sized bounds remain those of
the original export. Picking uses the smaller mask's normalized coordinates.
Replacement and eviction update owners' picking records before retired buffers
leave cache accounting, so those records cannot retain uncounted canvases.

A closer view asynchronously restores the full export while continuing to draw
the smaller image. Failed upgrades retain usable art without repeated requests.
An upgrade that finishes after eviction cannot resurrect the entry or add
untracked bytes. Query portraits advance their paint epochs so old inspected types
do not remain active indefinitely. Cold fallback cleanup, shared canvases and
asynchronous portrait refresh remain intact.

`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:working-set` exercises all 40
types at city zoom, a second paint with zero additional image requests, reduced
alpha picking, full-detail close-ups, failed upgrades, late results after eviction,
and reuse after visiting every query portrait. Faults are injected at the image
loading boundary because Chrome's document image cache can bypass network routes.

## Validation · 2026-09-07

- All 108 reward frames pass actual single-blit drawing, palette/state hashes,
  alpha picking, portrait bounds and cache limits. Family peak was 33,518,392 bytes.
- The full-library test makes exactly 40 initial image requests and none on its
  next paint. Peak retained bytes were 33,403,752, below 33,554,432 (32 MiB).
- Rewards total 2,376,306 bytes (2.27 MiB); the largest decoded frame uses 2,440,980
  bytes. The whole catalog totals 11,476,758 compressed bytes (10.95 MiB): 40 types,
  47 layouts and 564 frames. All 456 earlier frames and metadata are unchanged.
- All 309 Node tests, civic/power/water/parks/transport browser regressions,
  640 direct/cached comparisons, disaster rendering, gameplay smoke and build pass.
- Real-game inspection verifies locked and unique reward gates, all eight
  placements, shoreline siting, and a 5×5 stadium save roundtrip. District views
  cover every rotation by day and night, plus individual close-ups.
- Production deployment under `/nested/` passes the sample-city launch and all
  six galleries, loading all 564 WebP frames with relative asset URLs.
- Performance checks measured p95 frame intervals of 16.7 ms; the 128-size
  city used 18.1–19.5 ms redraws and 1.1–1.3 ms cached draws.

Independent review used a fresh Codex fallback after Claude rejected its effort
flag. Two cache findings were addressed: minimum zoom now uses the actual
zoom/DPR ratio, and picking records release retired buffers on reduction,
upgrade and eviction. Readiness promises also release buffer references instead
of retaining the original full-size canvas. Targeted regressions cover these behaviors. The reviewer
found no coverage, variant, gameplay, existing-export or model-circulation issues.
