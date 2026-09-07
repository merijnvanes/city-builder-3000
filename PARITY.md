# Gameplay parity tracking

Target: the original SimCity 3000 gameplay, with original artwork and smooth browser rendering. The current game is a substantial approximation; it is **not verified as an exact recreation**. A feature having the same name is not evidence that its simulation rules match.

Reference: [SimCity 3000 manual](https://manuals.plus/m/6c7512d61bba2d2ecc77b80c06fcd3dd8be386cc1de56abbf13a59a06779206e.pdf), printed pages 68–69, 92, 97–99. The following are confirmed comparison targets, not claims of implemented parity.

| Area | Reference behavior | Current gap |
| --- | --- | --- |
| Highways | Elevated routes; ramps provide road access | Flat single-tile routes connect directly to roads |
| Tunnels | Transport can pass through terrain | No tunnel construction or routing |
| Power | Eight plant types; aging reduces capacity; prolonged overload can destroy plants | **Done.** All eight types with the manual's invention years; output slides after 55% of a plant's life; a year of overdraw destroys one |
| Water | Freshwater pumps, towers, coastal desalinization; pumps age | **Done.** Sea and fresh water are distinct; three sources with the manual's weaknesses; pumps age and slow in dirty water; pipes reach seven tiles |
| Education | Childhood learning and adult knowledge retention; strikes from sustained underfunding | **Done.** EQ is taught to children aged 5-17, colleges take 18-22, adults decay without libraries or museums, and teachers strike after 18 months below 40% funding |
| Health | Average city reaches 59 years, a well-run one 90; hospitals need beds and funding; pollution and traffic pull it down | **Done.** Life expectancy is a cohort statistic on the same anchors, with healthcare strikes |

| Industry | Farms, heavy industry, manufacturing and high tech, the last attracted by an educated workforce | **Done.** See below |

| Aura | A per-neighbourhood mood map whose average is the mayoral approval rating | **Done.** See below |
| Public safety | Budget sets precinct size and effectiveness; overlaps are additive; jails cap police effectiveness | **Done.** See below |

Other systems needing controlled comparisons against the original game include growth thresholds, lot stages, land value, budgets, rewards, neighbor contracts and disasters. The manual describes behaviors but does not expose all numerical formulas. Exact balance requires repeatable reference-game experiments, not guessed constants.

## Demographics, September 7

Sims now have ages. `src/sim/population.js` holds a 110-year cohort pyramid, a
per-age Education Quotient and a Life Expectancy, all persisted in save
version 4.

Anchors taken straight from the manual (pages 91-93):

- An average city's Sims live to **59**; a well-run one reaches **90**.
- Children learn at school; adults only retain, and lose knowledge without
  libraries and museums.
- Schools, colleges and hospitals have **capacity**, so coverage alone is not
  enough. Querying one grades it A to F.
- Sustained underfunding calls a **strike**, and a cohort schooled during one
  carries the deficit for life.

The constants between those anchors are calibrated to reproduce them, not
recovered from the original game. The mortality curve is fitted by bisection
so the reported life expectancy is a measured mean, not a label.

## Industrial subtypes, September 7

`src/sim/industry.js` gives every industrial lot one of four kinds:
agriculture, heavy industry, manufacturing, high tech. Two forces pick it.

- **SimNation's economy** drifts from smoke toward silicon: heavy industry
  dominates before the war, manufacturing peaks mid-century, high tech is
  barely a rumour before the 1970s.
- **The city's own EQ** decides how much of that drift it can capture.

Measured over 140 years from 1900 on the same map and seed:

| | EQ | Pollution | Mix in 2050 |
| --- | --- | --- | --- |
| Schools, colleges, libraries, museums, 120% funding | 116 | 11 | farms + high tech |
| Education funding at zero | 43 | 17 | farms + heavy industry |

That is the manual's promise on page 92 reproduced: *"nasty polluting
industries turning into cleaner, high-tech industries."* The kind also sets
jobs per tile and tax yield, so a laboratory is worth more per worker than a
foundry, and farms employ few.

## Power plants, September 7

All eight types the manual lists, with its invention years: coal and oil
1900, gas 1955, nuclear 1965, wind 1980, solar 1990, microwave 2020, fusion
2050. Microwave and fusion are new, with original artwork.

- A plant runs at nameplate output for the first 55% of its life, then slides
  to 35%. The news warns twice: past its prime, then worn out. Querying one
  shows current against potential capacity, as the manual tells players to do.
- A network held above capacity for twelve straight months destroys a plant
  on it. A nuclear one takes the neighbourhood with it and leaves fallout.
- Wind turbines do better on hills, which is the manual's siting advice.

Two bugs surfaced by the longer test runs this needed, both pre-existing:

- A fire burning out a zoned but undeveloped tile emptied its type and left
  its density, writing a save the loader rejected.
- Clearing a lot put out fires on the rest of its footprint, so a tile still
  in that month's burning list decremented its counter below zero. Same
  outcome: an unloadable save.

And one this work introduced, now covered by tests: `tick()` aged plants
*after* the refresh that allocates power, so a save's ages did not match its
saved allocation and a reloaded city drifted within a year. Every mutation
now happens above the refreshes; `settle()` runs only the derive half.

## Water, September 7

Water tiles are now either fresh or sea, marked by the generator (only the
coast layout makes sea) and carried in the save. That one distinction makes
the manual's three sources meaningfully different:

| Source | Needs | Output | Slowed by dirty water |
| --- | --- | --- | --- |
| Water pumping station | fresh water within 2 tiles | 2,500 | heavily |
| Water tower | nothing, it draws on springs | 600 | a little |
| Desalinization plant (1960) | sea within 2 tiles | 1,800 | slightly |

A pumping station with no fresh water in reach has **no capacity at all**,
which is what the manual says. Coast towns are therefore founded on water
towers and can switch to desalinization once it is invented.

- Pipes water everything within **seven tiles**, up from six, and watered
  tiles still do not relay.
- All three sources wear out on the same curve as power plants, in `wear.js`.
- Water pollution comes from industry, as a concentration rather than a
  total, and treatment plants remove a share of it. Heavy industry fouls
  water; high tech barely touches it.

A coverage bug turned up here: a disconnected stub of pipe could claim tiles
by iteration order and strand a district that a supplied main ran past.
Coverage now goes to the nearest network, with a supplied one winning ties.

Two more determinism bugs, both pre-existing:

- Disasters and cancelled neighbour deals changed the city *after* the
  month's derived state was computed, so a save carried tiles that
  disagreed with it. Both now re-settle.
- `advanceEffects` returned early when a city had no effects list, so flood
  water never drained on a city that had never shown an on-screen effect —
  while a reloaded copy, which always gets a list, drained normally.

## Police and fire, September 7

Three rules the manual states plainly that the code contradicted:

| Manual | Was | Now |
| --- | --- | --- |
| "The size of a precinct expands as you raise the police budget" | fixed radius | radius scales 0.35× to 1.13× with the department budget; fire stops at a limit |
| "precincts that overlap... effectiveness in these overlapping areas is additive" | coverage took the maximum | police and fire add, capped at 160 |
| "a fire is just as likely to break out in an area with fire protection as in one without" | fire coverage reduced ignition | coverage decides damage only; unwatered zones raise the risk, as the manual says elsewhere |

Jails are new. "If you do not have enough jails in your city, the police will
be forced to release any new criminals they catch back onto the street." A
city short of cells loses police effectiveness everywhere, down to 35%. Two
percent of residents need a cell; a jail holds 400 and the maximum security
prison 1,200. Starter towns come with one, and querying a jail shows the
city's cells against its arrests.

## Aura, September 7

The manual, page 93: *"Neighborhoods each have their own aura. Study the Aura
map to see which areas of the city are happiest"*, and the approval rating is
*"a measure of the city's global aura"*.

Approval was its own formula. It is now the population-weighted average of a
real per-tile aura map, so the headline number and the map cannot disagree.
The map is a new overlay, on the same red-to-green ramp as land value.

What moves it, all from the manual's own list: education, life expectancy, a
neighbourhood's parks and culture, police and fire cover, and land value lift
it; pollution, crime, traffic, high taxes, landfills and prisons pull it down.
"Excessive regulations (ordinances)" is a penalty that grows once more than
four are in force, on top of each ordinance's own mood, which now lives in
the ordinance table as data rather than a list of special cases.

Residents also choose where to live by aura, so a well-kept district fills
before a grim one.

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
