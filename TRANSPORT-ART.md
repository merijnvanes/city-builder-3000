# Transport architecture

Five standalone transport buildings use original scripted Blender models and
transparent offline WebP sprites. Roads, rails, subway tracks, ramps and tunnel
bores retain their separate network rendering.

| Type | Footprint | Identity |
| --- | --- | --- |
| bus | 1×1 | Open glass shelter, sheltered bench, timetable and boarding edge |
| railstation | 2×2 | Brick ticket hall, clock gable and butterfly platform canopy |
| substation | 1×1 | Subway stairwell, handrails, ticket machine and metro portal |
| airport | 6×5 | Glazed terminal, control cab, hangar, apron, taxiways and runway |
| seaport | 4×4 | Freight shed, stacked cargo, braced gantry and quay bollards |

Sources are `tools/civic_art/transport.py` and `transport_ports.py`. The seaport
preserves all five original deterministic cargo palettes: `floor(seed * 5)`, with
saved normalized `tile.variant` taking precedence over the coordinate hash. Other
transport recipes had no seed-dependent layout branches. Nine layouts produce
108 frames across four views and daylight, powered night and unpowered night.

The airport declares `footprint: {w: 6, h: 5}` throughout the shared pipeline.
It is drawn at the original model scale with a measured origin anchor, never
stretched to a square. The remaining types retain legacy square `tiles` metadata.
The bus bench is behind the boarding route; subway rails stay outside the stair;
station canopy posts leave the platform edge open. Cargo rows, freight doors and
crane rails occupy separate operating areas. No parked block vehicles are added.

Run `npm run art:transport` for complete rendering and incremental packaging.
Preview into a separate directory, for example:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types transport --states day --rotations 0,2 --samples 16 \
  --output artifacts/transport-preview
```

Inspect `/civic-gallery.html?family=transport` at game size and close up.
`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:transport` checks all 108
runtime frames, palette/state differences, alpha picking, portraits and cache
limits, then generates all-layout contact sheets. `npm run test:art-contract`
checks metadata coverage and rectangular packaging. The original 6 MiB
civic/power/water and 0.75 MiB park budgets remain intact; transport has a separate
4 MiB compressed ceiling. The shared decoded cache remains 32 MiB.

## Integration boundary

Gameplay footprints, unlocks, balance and station/shoreline siting are unchanged
on this art branch. Current `main` instead has growable airport and seaport zones,
with varying lot dimensions up to 8×8. These fixed-lot exports implement the
handoff's authorized scope; they do not claim coverage of main's growing ports.
Before integration, extend authored coverage to that port contract. Exact-lot
matching deliberately retains procedural fallback for unmatched dimensions.

## Validation · 2026-09-07

- All 108 transport frames pass actual runtime single-blit drawing, palette and
  lighting hashes, top-silhouette alpha picking and unclipped portraits at every
  rotation. Peak decoded use was 33,545,000 bytes, below 33,554,432 bytes (32 MiB).
- Transport exports total 2,508,968 bytes (2.39 MiB); the largest decoded frame
  uses 2,625,792 bytes. The complete catalog has 32 types, 38 layouts and 456 frames.
- All 348 prior frames and their catalog metadata are unchanged. Manifest,
  rectangular packaging, normalized seed boundaries and civic lifecycle/gallery
  regression checks pass. The lifecycle harness now loads types on demand because
  complete catalog preloading exceeds the intended shared working set.
- Actual game placement verifies bus/rail/subway adjacency and shoreline siting.
  Airport serialization retains 6×5. The district was inspected in four daylight
  and nighttime views, with individual close-ups and gallery contact sheets.
- Model bounds were validated during every bake. Initial previews were corrected
  to open the shelter sides, reveal stair treads and expose cargo stacks from the
  main view. Preview directories remained separate from the complete bake.

Additional checks: parks cold-load/variant regression and all 60 park frames pass.
Production build and all 108 transport frames under `/nested/` pass. Local p95
frame intervals are 16.7–16.8 ms, cached CPU 0.6–1.2 ms and redraw 11.1–18.8 ms.
One daylight layout of every type occupies 26.59 MiB; the gallery's complete
variant set exceeds 32 MiB, so tests use the same on-demand lifecycle as gameplay.

Nighttime inspection refined the shelter light strips and lit metro lettering;
all 24 bus/subway frames were rebaked, and the 108-frame transport suite, contract
checks and production build passed again. Unpowered states extinguish those cues.

Final circulation checks turned railway benches toward the platform, added the
hall’s rear platform door, and closed the airport’s landside/apron/hangar paving
gaps. Updated exports passed the full transport suite, contract checks and build.

Independent review: fresh Codex fallback after Claude rejected its effort flag.
No blocking findings. Follow-ups were addressed: shared footprint eligibility now
controls drawing, culling height and shadow direction, with an unmatched-port
regression test; the benchmark warms only layouts and power states present in its
city. The final shared-runtime validation passed all 308 Node tests, civic and
transport lifecycle/gallery suites, 640 cached/direct comparisons, disaster
rendering, gameplay smoke, production build and final `/nested/` deployment.
