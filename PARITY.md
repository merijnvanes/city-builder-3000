# Gameplay parity tracking

Target: the original SimCity 3000 gameplay, with original artwork and smooth browser rendering. The current game is a substantial approximation; it is **not verified as an exact recreation**. A feature having the same name is not evidence that its simulation rules match.

Reference: [SimCity 3000 manual](https://manuals.plus/m/6c7512d61bba2d2ecc77b80c06fcd3dd8be386cc1de56abbf13a59a06779206e.pdf), printed pages 68–69, 92, 97–99. The following are confirmed comparison targets, not claims of implemented parity.

| Area | Reference behavior | Current gap |
| --- | --- | --- |
| Highways | Elevated routes; ramps provide road access | **Done.** Streets and highways interchange only at on-ramps |
| Tunnels | Transport can pass through terrain | **Done.** Road and rail bores through high ground, six tiles minimum |
| Power | Eight plant types; aging reduces capacity; prolonged overload can destroy plants | **Done.** All eight types with the manual's invention years; output slides after 55% of a plant's life; a year of overdraw destroys one |
| Water | Freshwater pumps, towers, coastal desalinization; pumps age | **Done.** Sea and fresh water are distinct; three sources with the manual's weaknesses; pumps age and slow in dirty water; pipes reach seven tiles |
| Education | Childhood learning and adult knowledge retention; strikes from sustained underfunding | **Done.** EQ is taught to children aged 5-17, colleges take 18-22, adults decay without libraries or museums, and teachers strike after 18 months below 40% funding |
| Health | Average city reaches 59 years, a well-run one 90; hospitals need beds and funding; pollution and traffic pull it down | **Done.** Life expectancy is a cohort statistic on the same anchors, with healthcare strikes |

| Commerce | Shops and offices, sorted by density and land value | **Done.** See below |
| Industry | Farms, heavy industry, manufacturing and high tech, the last attracted by an educated workforce | **Done.** See below |

| Budget | Six named services; over-funding wastes money; the road budget keeps roads from falling apart | **Done.** See below |
| Zone stages | Land value gates how far a zone builds out within its density | **Done.** See below |
| Waste | Landfills store trash, fill up, decompose and cannot be bulldozed; incinerators age | **Done.** See below |
| Aura | A per-neighbourhood mood map whose average is the mayoral approval rating | **Done.** See below |
| Public safety | Budget sets precinct size and effectiveness; overlaps are additive; jails cap police effectiveness | **Done.** See below |

| Siting | Stops need roads, stations need track, seaports want a seacoast | **Done.** See below |
| Neighbour deals | Purchases meter the deficit with a minimum fee; sales are an obligation; cancelling costs a large penalty | **Done.** See below |

Other systems needing controlled comparisons against the original game include growth thresholds, land value, rewards, petitions and disaster severity. The manual describes behaviors but does not expose all numerical formulas. Exact balance requires repeatable reference-game experiments, not guessed constants.

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

## Zone stages and waste, September 7

**Land value gates density.** *"Density sets the maximum density for a zone.
Land value of the zone must be very high in order for full density to be
reached."* One threshold at stage 3 became a table: each stage asks a land
value that rises with the zone's density, so a dense block reaches its top
stage only on a genuinely good address, and a lot whose neighbourhood decays
well past what its stage needs loses a storey. Foundries ask almost nothing;
laboratories ask nearly as much as offices.

**A landfill is a store, not an allowance.** *"Each tile of landfill can hold
up to a certain amount of trash... When a landfill is full, garbage will
accumulate around the city."* Landfills now hold 5,000 tons per tile, take
deliveries only where trucks can reach them, decompose 10 tons a month, and
fill up: a starter town has about seven years before the streets suffer, with
two warnings on the way.

They are also permanent: *"You can't bulldoze over landfills; however, you can
decommission them by removing road or rail access. Over time the landfill will
decompose all of its accumulated garbage, at which time you can de-zone it."*

Incinerators and recycling centres now lose capacity with age on the shared
wear curve, and two more pieces from the manual arrived: the **waste-to-energy
plant** (2000), which burns refuse and returns power, with original artwork,
and the **Trash Presort** ordinance, which raises recycling throughput 40%.

## What the budget buys, September 7

Two lines from the manual's budget page that the game ignored.

*"An over funded branch will waste money. Underfunding causes a loss of
effectiveness of the branch."* Funding above 100% bought up to 25% extra
coverage and teaching. It now buys nothing: the surplus is spent and lost,
exactly as the manual describes, while underfunding still costs effect.

*"Road Budget - Pays for road and highway maintenance, and keeps roads from
falling apart."* Roads never wore out. The network now carries a condition
that drifts toward what the transport budget sustains: 100% at full funding,
down to a floor of 25 with none. A worn surface carries fewer cars before it
jams, so skimping shows up as congestion a year or two later rather than at
once. Measured on one starter town, five years at 20% funding took the
condition to 40 and average traffic from 16 to 29; restoring the budget
brought both back over four years. Two warnings on the way down and one
all-clear on the way up, and querying any street reports its surface.

A regression test now checks that every building carrying a number the player
has to manage still reports it when queried. Two such lines had been lost to
an earlier edit without anything noticing.

## On-ramps, September 7

*"Highways may be built over roads, but if you want your Sims to be able to
get from one to the other, the intersection requires an on-ramp. On-Ramps
allow your Sims to get on and off highways."*

A street and a highway used to interchange wherever they touched, so a
highway was simply a faster road. They no longer connect at all: the only
tile both will step onto is an **on-ramp**, which must touch a highway and
reach the street network, and may stand on the road it joins. A highway
laid across a town without ramps now carries nobody, which is what makes
routing a corridor a decision rather than a formality.

A ramp behaves like a street in every other respect: it gives lots road
access, power jumps it, it carries traffic and pollution, and it costs
transport upkeep. Highways still give no lot access on their own.

Still open here: highways are not yet drawn elevated over the roads they
cross.

## Tunnels, September 7

*"A road or rail tunnel will be recommended by the city engineers when
traversing mountainous terrain... If the underground distance is sufficient
for the tunnel to be constructed, six tiles minimum, the city engineers will
ask if you wish to bore a tunnel and let you know the cost."*

Before a tunnel could be worth anything, hills had to cost something. The
router now charges a step per level climbed and again per level descended, so
a route over a ridge is slower than the same distance on the flat.

The tunnel tools then look straight ahead from where you click for the first
level ground with at least six tiles of higher ground in between, quote a
price per tile of bore, and cut it: an entrance, an exit, and a line beneath
the untouched hillside. Nothing joins that line except at the two portals.

Measured on a ridge eight tiles wide and eight levels high, with jobs near the
edge of a worker's range: on the flat every worker reaches a job, over the
ridge 23 of 154 cannot, and through the bore every one does again.

Portals are drawn as a retaining wall with the bore cut into it.

## Shops and offices, September 7

The manual lists what a commercial zone builds by density: light is *"mom and
pop stores, gas stations"*, medium adds *"medium size office buildings and
stores"*, dense has *"large office buildings and large stores"* — and *"the
type of Commercial buildings that get built depends on the density of the
zone, as well its land value."*

Commercial lots now hold shops or offices:

| | Light | Medium | Dense |
| --- | --- | --- | --- |
| Poorly schooled city | shops | shops | shops |
| Well schooled, poor address | shops | shops | offices |
| Well schooled, good address | shops | offices | offices |

Offices hold more workers per tile, pay more per head and bring no delivery
traffic; shops follow their customers. A city's commercial ceiling keeps
climbing with its Education Quotient, which is the manual's *"demand for
Commercial zones typically rises as a city ages"*.

Each lot decides from its own stable variant rather than a fresh roll, so a
corner shop does not become a tower and back again every decade. Without that,
the office share oscillated: offices bring less pollution, which raises land
value, which attracts more offices, and the loop overshoots in both
directions.

## Six city services, September 7

*"The Mayor makes the final decision on how to fund six city services"*, and
the manual names them: Education, Public Health, Fire, Road, Police, Mass
Transit. The game had six sliders, but not those six: one merged Transport
covering everything from kerbstones to airports, plus a Sanitation slider the
original does not have.

Transport splits. **Road** pays for roads, highways, ramps and road tunnels,
and is what keeps the surface from breaking up. **Mass transit** pays for
rail, stations, subways, buses, the airport and the seaport, and starving it
shrinks the reach of every stop and station.

Sanitation loses its slider, as in the original. Landfills, incinerators and
recycling centres cost what they cost and work at full effect; garbage is a
building problem, not a budget one.

## Neighbour deals, September 7

The manual is unusually specific about which side of a deal is metered and
which is a fixed obligation, and the game had every one of them as a flat
monthly fee.

**Buying** power or water: *"a contracted neighbour will look at your city's
needs at the connection point, and will supply any deficit... funds are
deducted based on how much you needed. If you didn't need any during the
month, you still have to pay a minimum fee."* Purchases now cover exactly the
shortfall on the network that reaches the border, up to a contracted cap, and
bill per unit with a standing charge.

**Selling** is the reverse: a fixed amount the city owes every month. *"If
conditions change and you can no longer provide the power you promised, the
deal is canceled and you'll be charged a large penalty."*

**Exporting garbage** takes *"all your excess garbage, meaning any garbage
that your city's landfills and incinerators cannot handle"*, so it now comes
last in the disposal chain and bills for what was actually hauled away.

**Cancelling** any deal costs a year of its standing charge, whether the mayor
walks away or the city simply stops being able to deliver. A city that cannot
afford the penalty is held to its contract.

## Where a building has to stand, September 7

Three rules the manual gives that the game did not enforce. In each case the
building could be placed anywhere and worked the same, so a mistake was
invisible.

- *"Bus stops must be placed along the side of roads to be effective."* A stop
  with no street beside it now covers nothing.
- *"Once the track is laid, you must place Train Stations on tiles that touch
  the track."* A station with no rail beside it is a building, not an
  interchange, and the same goes for a subway station with no line beneath.
- *"They must be located along a shoreline to do anything, but if you want to
  see real results, build one on a seacoast."* A seaport on a river works at
  40%; one on the sea works fully. The sea-versus-fresh distinction added for
  the water system is what makes this possible.

None of these refuse the placement. The game lets the mistake happen and then
quietly does nothing with the building, and the query card says why.

## Blackouts spread from the edges, September 7

*"Most blackouts occur when a power station can't generate enough power to
meet the demands of the area it serves. Power will radiate as far as possible
from the power station and then will just stop, leaving structures farthest
from the plant without power."*

A short grid used to serve buildings in tile order, so a brownout blacked out
a scattered, arbitrary set and told the player nothing. Consumers are now
served outward from the nearest plant, measured in hops across the conducting
grid, so the outskirts go dark first. Measured on one starter town with its
plant swapped for a small one: the lots still lit average 33 tiles from the
plant, the dark ones 52.

That makes a brownout legible. The dark ring shows where the next plant
belongs.

## Meltdowns and the siren, September 7

Two mechanics the manual describes and the game lacked.

**Radiation is permanent.** *"Sims will abandon buildings in a developed zone
when conditions warrant it... The only time Sims won't return is when an area
has been contaminated by radiation from a nuclear explosion. Too dangerous."*
A meltdown now leaves the ground contaminated for the life of the city:
nothing develops there again, land value falls to nothing, and the
neighbourhood's aura collapses. A **Nuclear Meltdown** joins the disaster
menu, and an overloaded reactor causes the same thing. Contaminated ground
shows as sickly green on the pollution map.

**The early warning siren.** *"If you can get your Sims off the streets and
inside before a disaster strikes, the damage from the disaster will be much
less... If you activate the siren when no emergency is imminent, Sims will
start to doubt you and may not respond when the need is real."* Sounding it
shelters people for three months and spares up to 55% of a disaster's damage.
A warning that comes to nothing costs a quarter of the mayor's credibility,
and a doubted siren shelters proportionally fewer people. Trust recovers when
a warning is followed by a real emergency.

One latent bug fixed with them: the nuclear explosion left a smoke cloud with
a twelve-month lifetime, but the save format caps effects at six, so the city
left behind could not be reloaded. Permanence now lives in the radiation flag,
where it belongs, and the disaster save-integrity test covers meltdowns.

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
