# Business-deal architecture

Five catalog entries with `offer` metadata now have original scripted Blender
models. Reward entries in the same gameplay group remain a separate collection.
No offer income, unlock condition, uniqueness, footprint or simulation effect changes.

| Site | Lot | Authored identity |
| --- | --- | --- |
| Prison | 4×4 | Guard towers, stone perimeter, screening gate, paired cell wings and exercise court |
| Casino | 3×3 | Stepped Art Deco hotel, rounded gaming hall, gold marquee and planted forecourt |
| Toxic waste dump | 3×3 | Segregated containment bunds, drum storage, reception and service aisle |
| Army base | 5×5 | Four barracks, headquarters, parade square, workshop and controlled entrance |
| Gigamall | 4×4 | Anchor stores, glazed roof lantern, storefronts, covered entrance and rear loading |

Sources: `business_secure.py`, `business_leisure.py`, and `business_waste.py`
under `tools/civic_art/`. Four casino and five mall palettes carry the original
vehicle-color variety into architectural accents; three waste-storage arrangements
vary drum colors and heights. Tiny block cars are omitted under the approved art
direction. These are fourteen deterministic authored layouts, selected from the
saved normalized seed (with coordinate fallback), yielding 168 exported frames.
The formerly coordinate-random drum field is now a finite set of authored layouts.

Circulation checks include an open prison gate and exercise-yard entrance,
nonoverlapping paving at base intersections, separated barracks approaches, an
unobstructed mall entrance and rear loading apron, and storage bunds clear of the
waste site's central access aisle. Preview corrections removed floating equipment,
intersecting paving surfaces and coincident tower/perimeter faces.

Run `npm run art:deals` for complete rendering and incremental packaging.
Inspect `/civic-gallery.html?family=deals` at game size and close up, rotating
through day, powered night and unpowered night. Previews must use a separate
output directory; never package incomplete render metadata.

`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:deals` verifies every runtime
frame, palette, lighting state, alpha pick and portrait. The family has a separate
5 MiB compressed budget; earlier family ceilings and the shared 32 MiB decoded
cache remain unchanged. The full-library working-set test now covers 45 types.

## Validation

- All 168 frames pass runtime blits, palette/state differentiation, silhouette
  picking and portraits. Peak retained decoded memory: 33,552,864 bytes.
- The 45-type city working set makes 45 initial requests and none on its next
  paint; peak retained bytes: 33,513,844, within the 33,554,432-byte cap.
- Offer locks and uniqueness, all five real placements, a 5×5 army-base save
  roundtrip, every day/night rotation and individual close-ups were checked.
- Contract/packaging tests and production build pass. The production `/nested/`
  deployment launches the sample city and loads all seven galleries, 732 frames.
- Business deals total 4,440,774 compressed bytes (4.24 MiB), within the 5 MiB
  family cap. The preceding 564 frames and their catalog metadata are unchanged.
- Performance p95 frame intervals: 16.7–16.8 ms. The 128-size city measured
  18–18.4 ms redraws and 1 ms cached draws.

Independent source review: fresh Codex fallback after Claude rejected its effort
flag. No blocking findings; footprints, model functions, variants, integration and
unchanged gameplay were confirmed. Export completeness was verified separately by
the full runtime and production-gallery checks above.
