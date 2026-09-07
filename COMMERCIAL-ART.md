# Commercial architecture

All 24 supported density/stage/footprint combinations have authored models:
1×1 low density, 1×1/2×2 medium density, and 1×1/2×2/3×3 high density, each at
levels 1–4. The family contains 136 layouts and 1,632 four-view/three-light frames.

| Density | Layout selection | Architecture |
| --- | --- | --- |
| Low | Five seed ranges | Corner market, scarlet diner, filling station (retail at levels 3–4), plum shops, blue diner |
| Medium | Seven seed ranges | Limestone offices, brick hotel, department store, glazed offices, grand hotel, city department store, teal offices |
| High, 1×1 | Three seed thirds | Curtain wall, stepped spire, copper gable |
| High, larger lots | Three regular plus three signature families | Existing coordinate-based 45% signature choice; limestone crown, recessed glass crown, garden terraces |

`zone_retail.py`, `zone_business.py` and `zone_office_towers.py` provide models;
`zone_commercial.py` provides complete state entry points. Offices have continuous
curtain walls, fine mullions and illuminated panes; signature roofs retain distinct
silhouettes. Shops have separate pedestrian approaches and parking strips; filling
stations have open canopies and actual pumps. Hotel entrances and signs, retail
awnings, mechanical roofs and podium planting distinguish the families.

Seed values remain normalized. Signature tower selection still uses
`random(x,y,37)<.45`, separate from the seed thirds. Saved terminal seed `1` follows
the legacy architectural branch. Real save/load and boundary regressions cover
these choices. Existing commercial subtypes continue to govern simulation and
naming; this migration retains the established density/seed art contract without
changing commerce, growth, economy or placement rules.

`npm run art:commercial` renders and packages the complete family.
`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:commercial` checks selection,
every sprite, picking, portraits, gallery contact sheets and mixed-city caching.
Inspect `/civic-gallery.html?family=commercial`. This family has a separate 32 MiB
compressed budget and shares the existing 32 MiB decoded on-demand cache.

The shared selector also preserves the legacy medium-residential terminal seed:
large lots choose courtyard wings at `1`, while one-tile lots retain balconies.
A focused regression covers this footprint-dependent edge case.

Independent bounded source review completed with no blocking findings. Its suggested
extra save tests now cover raw `1` and near-terminal `.9996`/`.9994` seeds at every
commercial density and both large-lot skyline branches. The selection suite passes.
Claude's installed CLI rejected `--effort`; a fresh read-only Codex review completed
as the same-provider fallback.

Visual inspection of the first full city bake caught an overly regular diagonal
window-light pattern on large glass towers. The final source uses deterministic
irregular occupancy and softer warm emission, while keeping daytime panes blue.
The affected tower states are rebaked in every view and lighting state.
A focused independent follow-up review found no blockers in the lighting refinement:
material lifetime, state switching, local random seeds and geometry margins agree
with the offline renderer.

## Validation

All 1,632 final frames pass distinct layout/view/lighting pixels, single-blit
rendering, exact silhouette picking and unclipped portraits. All 136 layouts were
placed through real zoning and lot assignment, preserved through save/load, and
inspected in every day/night rotation. Gallery sheets and the actual starter city
were visually inspected, including the corrected night skyline.

The final family is 26,535,372 bytes, with a tallest measured silhouette of 176
world-screen units and a largest decoded frame of 1,564,540 bytes. The 286-layout
mixed working set loads each frame once, retains all picking records and peaks at
33,551,636 bytes under the shared 32 MiB cap. All previous 74 catalog entries and
1,992 frames are unchanged, as are the low/medium commercial frames after the
lighting refinement. All 319 Node tests pass; targeted final-art contracts pass.
The fixed-family runtime and working-set checks also pass.

Final 640 direct/cache comparisons and disaster rendering checks pass. Production
`/nested/` loads the sample city, all ten galleries and all 3,624 frames. Warm
64/128-city redraw p95 is 11.0–19.3 ms; cached p95 is 0.5–1.0 ms and frame-interval
p95 is 16.7–16.8 ms on this machine.
