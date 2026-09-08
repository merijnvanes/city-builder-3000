# Residential architecture

All supported residential growth states have authored Blender models: density 1
on 1×1 lots, density 2 on 1×1 and 2×2 lots, and density 3 on 1×1, 2×2 and 3×3 lots.
Each covers levels 1–4. The 24 state/footprint entries contain 100 layouts and
1,200 rotation/lighting frames.

| Density | Preserved seed ranges | Architecture |
| --- | --- | --- |
| Low | Four quarters | Gabled cottage, hipped home, Craftsman veranda, garden-roof modern |
| Medium | Three thirds | Masonry apartments, brick brownstones, balcony apartments; larger lots gain courtyard wings or gardens |
| High | Five fifths | Stone podium tower, terracotta setbacks, balcony tower, glazed podium tower, brick setbacks |

Five high-density seed ranges retain the original `floor(seed*5)%3` silhouette
selection; setbacks remain specific to lots at least 2×2, and mature 3×3 podium
lots gain paired towers. Low-density upgrades add garages, a second storey and a
small pool. Every authored stage has deliberate dimensions and entrances rather
than stretching one image across different lots. Seeds retain their original
normalized meaning and coordinate fallback.

Models are split across `zone_homes.py`, `zone_apartments.py`, and `zone_towers.py`,
with entry points in `zone_residential.py`. Short-storey window placement avoids
roof intersections. Paths reach home doors and garages; courtyard mouths remain
open, and benches occupy separate pads facing the garden approach.

## Shared zone integration

Registry `zone` metadata identifies type, density and level, while `tiles` retains
an exact footprint. The shared on-demand cache selects the full state key before
choosing the seed layout. Fixed-building exports and selection remain unchanged.
Construction cranes and scaffolding are drawn as temporary overlays; their
expanded bounds use the existing exact click-pixel picking path. Abandoned zones
retain weeds and muted art, and their night sprites use the unpowered window state.
Undeveloped lots retain zone markers. No simulation or growth rules change.

Dense facades use direct Blender mesh primitives in a scoped zone-only context.
This avoids repeated dependency-graph updates for thousands of window objects;
materials, bevels, measured bounds and offline lighting are retained. Existing
fixed-building rendering uses the original primitives. The window grid aligns
to storeys, and every home has a small powered porch light.

`npm run art:residential` produces the complete family. Inspect
`/civic-gallery.html?family=residential`, and run
`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:residential` for the complete
frame matrix, picking, portraits, lifecycle checks and density/stage contact sheets.
The family has a separate 24 MiB compressed budget. The decoded shared cache stays
at 32 MiB, loading only requested states/layouts. Prior family ceilings are unchanged.

## Validation

The complete 1,200-frame runtime matrix passes one-blit rendering, exact alpha
picking, distinct view/lighting/layout pixels and unclipped portraits. The 150-site
mixed working set (all residential layouts plus every fixed building type) loads
once, keeps picking coverage and peaks at 33,540,484 decoded bytes. Growth changes
frames; construction cranes remain pickable; abandoned nighttime lots request
unpowered art. All 313 Node tests and the gameplay browser suite pass.

The packaged family is 22,272,310 bytes; its tallest measured silhouette is 125
world-screen units and largest decoded frame is 1,390,956 bytes. All 50 preceding
catalog entries and their 792 frames are unchanged. Density/stage contact sheets,
rear night elevations, the actual starter neighborhood and a placed 100-layout
city matrix were visually inspected. Save/load preserves the chosen layout under
the existing three-decimal seed serialization. Direct mesh primitive checks cover
dimensions, outward winding and restoration of fixed-art helpers after exceptions.

The fixed-art working-set regression, 640 direct/cache comparisons and disaster
rendering checks pass. Production `/nested/` loads the sample city, all nine
galleries and all 1,992 exports without broken relative URLs. Warm 64/128-city
performance measured 11.1–20.2 ms redraw p95, 0.5–0.9 ms cached p95 and
16.7–16.8 ms frame-interval p95 on this machine.

Independent review completed with no blockers and one low-severity terminal-seed
compatibility finding. Fixed: high-density saved seed `1` retains the legacy
balcony family (`floor(1*5)%3`), including seeds rounded to `1` by real save/load.
The targeted zone/variation regression suite passes. Claude's installed CLI rejected
`--effort`; a fresh read-only Codex review completed as the same-provider fallback.
