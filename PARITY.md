# Gameplay parity tracking

Target: the original SimCity 3000 gameplay, with original artwork and smooth browser rendering. The current game is a substantial approximation; it is **not verified as an exact recreation**. A feature having the same name is not evidence that its simulation rules match.

Reference: [SimCity 3000 manual](https://manuals.plus/m/6c7512d61bba2d2ecc77b80c06fcd3dd8be386cc1de56abbf13a59a06779206e.pdf), printed pages 68–69, 92, 97–99. The following are confirmed comparison targets, not claims of implemented parity.

| Area | Reference behavior | Current gap |
| --- | --- | --- |
| Highways | Elevated routes; ramps provide road access | Flat single-tile routes connect directly to roads |
| Tunnels | Transport can pass through terrain | No tunnel construction or routing |
| Power | Eight plant types; aging reduces capacity; prolonged overload can destroy plants | Six types; output is fixed and overload produces brownouts |
| Water | Freshwater pumps, towers, coastal desalinization; pumps age | No saltwater distinction or desalinization; fixed lifespan |
| Education | Childhood learning and adult knowledge retention; strikes from sustained underfunding | Service coverage approximates education without those dynamics |

Other systems needing controlled comparisons against the original game include growth thresholds, lot stages, service capacity, land value, pollution, budgets, rewards, neighbor contracts and disasters. The manual describes behaviors but does not expose all numerical formulas. Exact balance requires repeatable reference-game experiments, not guessed constants.

## Visual and performance work, September 7

- Preserved and verified the previous agent's query-card sizing/rotation work.
- Connected street pavement, all-arm intersection crossings, bridge railings, depth-sorted lamps and projected vehicles.
- Graded façades and reflective glass, darker night ground and buildings with bright windows.
- Ground lighting stays below buildings. Platforms no longer erase earlier cast shadows.
- Reused tree artwork and a building atlas capped at 48 MiB of pixel data per renderer. Terrain ordering/colors survive camera movement.
- Removed the near-30-FPS frame limiter; arrow/WASD movement now follows frame time and stops on release/focus loss.
- Browser gameplay checks, camera/architecture regression checks, and a reproducible performance script. Performance numbers are local measurements, not guarantees for all browsers/devices.

Remaining visual priorities: inter-lot occlusion on unusual multi-building footprints, richer shore geometry, elevated transport and tunnels, aircraft altitude/occlusion, and additional original architectural families. Performance work still needs profiling of cold cache rebuilds, rapid zooming and large cities during simulation ticks.

## Implementation follow-up after testing was stopped

At the user's request, no further tests or benchmarks were run for this follow-up. Earlier passing results and performance measurements do not validate the changes below.

- Fixed cache churn on Retina displays: entries used in the current or preceding paint are protected; overflow uses direct rendering without allocating sprites.
- Cache each lot's visual state independently of the simulation month. Quantize building raster scales and reuse a fixed-resolution tree atlas across zoom gestures.
- Increased forest crown variety; snap bitmap placement to device pixels.
- Apply night exposure consistently to architectural materials, including pitched roofs, cylinders and query portraits. Unpowered lots no longer show illuminated windows.
- Shortened junction curbs to keep them out of crossing traffic lanes.
- Added three original commercial tower families: limestone setbacks with copper crowns, slim glass towers, and planted terraces.
- Added fading shallow-water shelves at shorelines.
- Retain terrain colors when monthly updates do not change terrain. Cache minimap terrain independently of camera movement.

The artwork and cache changes are implemented but remain unverified following the explicit stop-testing instruction. Exact gameplay parity remains unfinished.
