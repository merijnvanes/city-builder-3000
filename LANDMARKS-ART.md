# Landmark architecture

All five `group: 'landmark'` entries use original scripted Blender models. The
original recipes had no architectural seed branches, so five layouts yield sixty
frames across four rotations and three lighting states.

| Landmark | Lot | Identity |
| --- | --- | --- |
| Clock tower | 2×2 | Slender brick campanile, four clock faces, copper cap and planted square |
| Opera house | 3×3 | Copper-domed auditorium, columned foyer, backstage fly tower and golden lyre |
| Observatory | 2×2 | Open meridian slit, tilted telescope, compact astronomy hall and low lights |
| Cathedral | 3×3 | Twin spires, rose-window tracery, nave, lower aisles and transept |
| Aquarium | 3×3 | Paired wave roofs, glazed clerestories and entrance-side tidal exhibits |

Models live in `tools/civic_art/landmark_monuments.py` and
`landmark_destinations.py`. These differ from the existing university rotunda,
municipal clock tower and museum through their silhouette and specific equipment.
Aquarium roofs have glazed end walls and supporting posts; the telescope occupies
an actual opening in its dome. Main and service entrances connect to paving.
The observatory bench sits on its own pad clear of the approach.

`npm run art:landmarks` bakes and incrementally packages the family. Inspect
`/civic-gallery.html?family=landmarks` at normal scale and close up, then rotate
through the day, powered-night and unpowered-night controls. Runtime validation:
`CIVIC_TEST_URL=http://127.0.0.1:4191 npm run test:landmarks`.

The family has a separate 2 MiB compressed ceiling. Existing family budgets and
the shared 32 MiB decoded cache are unchanged. The working-set test covers fifty
fixed building types. No placement rule, uniqueness, cost or simulation effect
changes; the aquarium still requires nearby water.

## Validation

- All sixty frames pass actual blits, lighting-state differentiation, silhouette
  picking and portrait framing. Family peak retained bytes: 33,528,456.
- The fifty-type working set makes fifty initial requests and none on repaint;
  peak retained bytes: 33,510,404, below the unchanged 33,554,432-byte cap.
- All five real placements, uniqueness, aquarium shoreline siting and save
  footprint, every day/night rotation and individual close-ups were checked.
- Contract/packaging and production-build checks pass. The `/nested/` deployment
  launches the sample city and all eight galleries, loading all 792 frames.
- The family totals 910,124 compressed bytes (0.87 MiB). All preceding 732 frames
  and their metadata are unchanged.

Independent source review used a fresh Codex fallback after Claude rejected its
effort flag. No blocking findings. The review identified stale landmark status in
two historical family guides; those references now point to this completed family.
