# Industrial architecture

The 28 supported industrial state/footprint entries contain 152 authored layouts
and 1,824 frames. Every density covers growth levels 1–4. Low density retains both
3×3 farms and 1×1 workshops; medium density uses 1×1/2×2 lots; high density uses
1×1/2×2/3×3 lots.

| Density | Selection | Architecture |
| --- | --- | --- |
| Low, 3×3 | Four crop ranges | Grain, green row crops, furrows and orchard; barn, silo, farmhouse, connected paths, growth-stage equipment |
| Low, 1×1 | Five palettes | Sawtooth workshop, loading shutters, storage and service yard |
| Medium | Seven unequal seed intervals | Union of original warehouse thirds and cargo-color fifths; both warehouses and chimney factories remain |
| High | Five cargo palettes | Sawtooth process hall, three stacks, connected tank storage, cargo and a clear loading apron |

`zone_farms.py` and `zone_factories.py` provide the architecture, with state entry
points in `zone_industrial.py`. Factory glazing uses metal grids, sawtooth roofs
have steep glazed northlights, warehouses have long rooflights, and all shutters
have powered task lights. Storage containers are detailed cargo assets; no block
cars are used. Farm gates and paths connect fields, barn and farmhouse. Later farm
stages gain hay storage, a greenhouse and a water barrel.

The medium-density intervals are `[0,.2,1/3,.4,.6,2/3,.8,1]`; treating these as
seven equal buckets would change existing warehouse and cargo identities. Terminal
seed `1` wraps palettes as the legacy recipes do. Exhaustive thousandth-seed and
boundary tests compare the independent original warehouse/color expressions, and
real save/load covers all branches and rounded terminal seeds. Existing industry
subtypes still control simulation and names; growth, siting, pollution and economic
rules are unchanged.

`npm run art:industrial` renders and packages this family.
`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:industrial` validates selection,
every frame, portraits, picking, gallery sheets, city placement and save identity.
Inspect `/civic-gallery.html?family=industrial`. The family has a separate 32 MiB
compressed allowance and uses the same bounded 32 MiB on-demand decoded cache.

Independent bounded source review completed with no blockers. It confirmed all
28 state entries and 152 layouts, unequal seed intervals, terminal wrap, model
bounds/approaches and deterministic lighting. Claude's installed CLI rejected
`--effort`; a fresh read-only Codex review completed as the same-provider fallback.
The industrial and prior variation suites pass, including real save/load cases.

The complete export is 17,491,772 bytes; the tallest measured silhouette is 58
world-screen units and the largest decoded frame is 890,760 bytes. All prior 98
catalog entries and 3,624 frames are unchanged. The final catalog has 126 entries,
454 layouts and 5,448 frames across eleven families. Environment compatibility
and optional separate polish are recorded in ENVIRONMENT-ART-AUDIT.md.

## Validation

All 1,824 frames pass distinct view/layout/lighting pixels, single-blit rendering,
exact silhouette picking and unclipped portraits. All 152 layouts were placed
through actual zoning and lot assignment, retained their family after real
save/load, and rendered in all day/night rotations. Final gallery sheets and the
mixed starter town were visually inspected. Low-density farming and workshop
silhouettes, warehouse rooflights and heavy-plant tanks/stacks remain distinct.

The full 438-layout mixed working set loads each frame once, retains all picking
records and peaks at 33,551,088 bytes under the shared 32 MiB cap. Growth,
construction-crane picking and abandonment/unpowered selection pass. All 322 Node
tests, the full gameplay browser suite, fixed-family runtime/working-set checks,
640 direct/cache comparisons and disaster-rendering regressions pass.

Production `/nested/` loads the sample city, all eleven galleries and all 5,448
frames without broken asset URLs. Warm 64/128-city redraw p95 is 11.1–17.5 ms;
cached p95 is 0.6–1.2 ms and frame-interval p95 is 16.7–16.8 ms on this machine.
