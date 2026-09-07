# Gameplay parity tracking

Target: the original SimCity 3000 gameplay, with original artwork and smooth browser rendering. The current game is a substantial approximation; it is **not verified as an exact recreation**. A feature having the same name is not evidence that its simulation rules match.

Reference: [SimCity 3000 manual](https://manuals.plus/m/6c7512d61bba2d2ecc77b80c06fcd3dd8be386cc1de56abbf13a59a06779206e.pdf), printed pages 68–69, 92, 97–99. The following are confirmed comparison targets, not claims of implemented parity.

| Area | Reference behavior | Current gap |
| --- | --- | --- |
| Highways | Elevated routes; ramps provide road access | **Done.** They interchange only at on-ramps, and one may be built over a street, which keeps running underneath. The deck is drawn raised at crossings; the rest of a highway is still drawn flat |
| Tunnels | Transport can pass through terrain | **Done.** Road and rail bores through high ground, six tiles minimum |
| Power | Eight plant types; aging reduces capacity; prolonged overload can destroy plants; blackouts are local to a grid | **Done.** All eight types with the manual's invention years; output slides after 55% of a plant's life; a year of overdraw destroys one; the advisor reads the worst-off network rather than the city-wide total |
| Water | Freshwater pumps, towers, coastal desalinization; pumps age | **Done.** Sea and fresh water are distinct; three sources with the manual's weaknesses; pumps age and slow in dirty water; pipes reach seven tiles |
| Education | Childhood learning and adult knowledge retention; strikes from sustained underfunding (transit too) | **Done.** EQ is taught to children aged 5-17, colleges take 18-22, adults decay without libraries or museums, and teachers strike after 18 months below 40% funding |
| Health | Average city reaches 59 years, a well-run one 90; hospitals need beds and funding; pollution and traffic pull it down | **Done.** Life expectancy is a cohort statistic on the same anchors, with healthcare strikes |

| Commerce | Shops and offices, sorted by density and land value | **Done.** See below |
| Industry | Farms, heavy industry, manufacturing and high tech, the last attracted by an educated workforce | **Done.** See below |

| Budget | Six named services; over-funding wastes money; the road budget keeps roads from falling apart | **Done.** See below |
| Loans | Ten years of annual payments totalling 150%, $5K increments to $25K, ten at a time, no early repayment | **Done.** See below |
| Zone stages | Land value gates how far a zone builds out within its density | **Done.** See below |
| Waste | Landfills store trash, fill up, decompose and cannot be bulldozed; incinerators age | **Done.** See below |
| Aura | A per-neighbourhood mood map whose average is the mayoral approval rating | **Done.** See below |
| Land value | Pylons blight the ground; safety and convenient transport lift it | **Done.** See below |
| Public safety | Budget sets precinct size and effectiveness; overlaps are additive; jails cap police effectiveness; coverage raises land value | **Done.** See below |

| Fire | Per-building flammability, halved by water and cut by ordinance; relief scaled by preparedness; one crew per station plus the volunteers | **Done.** See below |
| Disasters | Permanent radiation after a meltdown; an early warning siren that can be abused; riots the police can break up | **Done.** See below |
| Siting | Stops need roads, stations need track | **Done.** See below |
| Ports | Airports and seaports are zones the Sims develop, with a minimum footprint | **Done.** See below |
| Neighbour deals | Purchases meter the deficit with a minimum fee; sales are an obligation; cancelling costs a large penalty | **Done.** See below |
| Petitioners | Neighbours bring deals to the Meet window on terms that change; a rejected petitioner may never return | **Done.** See below |
| Commuting | Zones beyond a reasonable commute do not develop; bad traffic shortens how far Sims will go | **Done.** See below |

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
rail, stations, subways, buses and the port zones, and starving it shrinks the
reach of every stop and station.

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

Rules the manual gives that the game did not enforce. In each case the
building could be placed anywhere and worked the same, so a mistake was
invisible.

- *"Bus stops must be placed along the side of roads to be effective."* A stop
  with no street beside it now covers nothing.
- *"Once the track is laid, you must place Train Stations on tiles that touch
  the track."* A station with no rail beside it is a building, not an
  interchange, and the same goes for a subway station with no line beneath.

Neither refuses the placement. The game lets the mistake happen and then
quietly does nothing with the building, and the query card says why. The
seaport's berth rule works the same way and now lives with the port zones
below.

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

## Flammability and relief, September 7

*"All buildings in your city have an inherent flammability rating, which you
can see if you query the building... The most effective way to reduce the
flammability of a building is to see that it is receiving water... The
reduction in potential fire damage is significant."*

Every building now carries a flammability rating shown on its query card.
Water roughly halves it, which is the manual's stated best defence; industry
and abandoned blocks burn worse, utilities better. The rating decides where a
fire starts, how readily it spreads to a neighbour, and whether a burning
building is actually consumed. A new **Fire Code** ordinance cuts it citywide
by 30%, which is the manual's *"ordinances can be enacted to reduce the global
flammability level"*.

*"In the event of a catastrophic disaster, the powers that be in SimNation may
take it upon themselves to assist you in the clean up costs. Be forewarned, a
Mayor that is well prepared generally receives better treatment."* Losing six
or more lots to a disaster now draws a relief grant, and a city with funded
fire and police coverage receives about twice what a neglectful one gets.

## Riots the police can break up, September 7

> *"Fires and riots are the only disasters where you can make a difference by
> dispatching fire and police units. It doesn't matter how many police officers
> you send to an earthquake or alien attack, it won't make any difference once
> the disaster hits, though the Early Warning Siren helps if activated
> beforehand."*

A riot used to set four fires and be over. There was nothing to dispatch to,
and the manual's whole point about riots is that there is.

A riot now stands: it takes a seat in the worst block it can find and keeps
setting fires around it for four months, or until the police reach it. A new
**Police Unit** joins the Fire Crew in the emergency tools, counted the same
way as fire crews are - one per precinct plus one - committed for the month it
goes out, and carried in the save so a reload does not refill the patrol cars.
Sending one within six tiles of the seat disperses the crowd; the fires it has
already set still have to be put out by the fire crews.

A sounding siren spares a share of the fires a riot sets, as it does for every
other disaster: *"the Early Warning Siren helps if activated beforehand."*

The riot draws as a tinted district with a crowd milling in the streets, which
is how the mayor finds the block to send a car to. Finding that needed fixing a
real bug first: the overlay was painting into the retained background layer
instead of the live one, so every frame of a "translucent" wash stacked into
the cache until the district was solid red.

## Highways over streets, September 7

The last of the three gaps the previous session left open.

> *"Highways are basically elevated, high capacity roads."*
> *"When you build a road that crosses an existing road, city engineers will
> automatically create an intersection for you. Highways may be built over
> roads, but if you want your Sims to be able to get from one to the other,
> the intersection requires an on-ramp."*

The interchange half was already right: a street and a highway meet only at a
ramp. The other half was not: a highway refused to go on an occupied tile at
all, so it could not cross a street without the mayor bulldozing it first, and
bulldozing it cut the neighbourhood in two.

A tile now carries `under`: the road or rail line running beneath an elevated
highway, mirroring `tunnel` for a bore. Laying a highway across a street costs
twice the open-ground price and leaves the street where it was; bulldozing the
deck puts the street back. The buried route still gives the lots beside it road
access, still bills the road or transit budget, and still counts as a border
connection.

Commuting gained a third layer for it. The graph already had two - the surface
and the subway tunnels - and the street under a viaduct is a third: a highway
on the deck steps along the deck, everything else steps along the ground, and
the two never meet except at a ramp. The layer is only allocated for a city
that has a viaduct somewhere, and the hot neighbour lookup keeps its original
form when there is none, so a city without one pays nothing: 32.1ms a month on
a 128x128 city against 31.3ms before.

Measured on one street crossed by one highway: with the viaduct the
neighbourhood reaches 1,800 residents and its workers get to the works; with
the highway laid through the street instead, the neighbourhood never develops
at all.

The deck is drawn raised on piers, with railings and a shadow on the street it
crosses. Highways away from a crossing are still drawn flat, which the manual
would have elevated throughout; that is the piece still outstanding.

## Transit strikes, and safety on the ground, September 7

**Transit workers walk out too.** The manual, on the mass transit budget:
*"If the mass transit budget is low, things will start deteriorating and Sims
will be less likely to use the system. If the budget is far below adequate,
transit workers will go out on strike."*

Teachers and hospital staff already struck; transit was the third branch the
manual names and the only one that could be starved indefinitely without
consequence beyond a shorter coverage radius. It now uses the same eighteen
months of anger below 40% funding, and a picket line shuts every stop and
station in the city: no bus or rail coverage, no station interchanges, no
subway. The Transportation Advisor says so, and approval drops five points
until the drivers are back.

**Police and fire coverage raises land value.** *"Good police and fire coverage
raises land values in a city, which makes Sims happy and proud to be
citizens."* Land value counted parks, culture, schools and hospitals but had no
idea whether the streets were safe. Both now lift it, half as strongly as a
park does.

**So does a bus stop or a station.** *"Land value is influenced by many
factors, including pollution levels, crime levels and the availability of
convenient transportation."* Transit coverage was the one item on that list
land value ignored. A stop with no street beside it still lifts nothing, since
nobody uses it.

The aura test that measured red tape had to change with this: it compared two
approval ratings rounded to whole points, and the extra land value pushed both
arms onto the same integer. It averages the aura map itself now, which has the
resolution the effect needs.

## Loans by the book, September 7

Page 63 lists the loan rules outright, and the game matched almost none of them.

> *"You may have up to ten loans outstanding at any time."*
> *"Loans are available in 5000 Simoleon increments, up to 25K per loan."*
> *"Each new loan is extended for ten years, and cannot be paid off early."*
> *"The city must make annual payments on each loan for ten full years."*
> *"Annual payment amounts are based on principal and interest."*
> *"When the final payment is made in the tenth year, the loan is repaid and
> comes off the books."*
> *"Total payments made will equal approximately 150% of the original loan
> amount."*

Before: any amount at all up to a $100,000 debt ceiling, sixty **monthly**
payments, 116% repaid in total, and the mayor could clear a loan whenever the
treasury allowed. Now: $5,000 to $25,000 in $5,000 steps, ten of them at a
time, **ten annual payments of 15% of the principal** - exactly the manual's
150% - falling due on the anniversary of the month the loan was taken, and no
paying one off early.

The last line of the manual gives the interest away, so there is no rate to
guess: 15% a year for ten years is 10% principal and 5% interest, which is
what *"based on principal and interest"* asks for. The $100,000 debt ceiling
goes; the manual's own limit is ten loans of $25,000.

`amortize()` tracks the balance and `computeBudget()` charges the treasury, so
both had to learn the annual cadence together or the ledger and the bank
balance would drift apart. Both now ask the same `loanDue()`.

And from the Financial Advisor's Q&A, on Auto Budget: *"As soon as your
finances go into the negative, Auto Budget will be turned off. This way you can
hopefully recover before things get too out of hand."* A city that has switched
the year-end review off gets it back the month the treasury goes into the red.

## Two more from the advisors' Q&A, September 7

**Fire crews are counted, and there are not many.** Maria Montoya, Public
Safety, answering *"A fire broke out but I was only able to dispatch a single
fire truck"*:

> *"That is because you have no fire stations, and therefore, had to rely on
> your volunteer brigade. If you want to be able to dispatch more units, you
> must build fire stations. You will have one dispatch unit for each fire
> station you build, plus one for the volunteer group."*

The mayor could send a crew to every fire in the city, every month, for $300
each. There is now exactly one crew for every fire station plus one for the
volunteers, they are committed for the month they are sent out, and the count
comes back with the new month. It is carried in the save, so reloading does not
refill the trucks. The tool hint counts them down as they go.

**Pylons blight the ground under them.** Gus Speedwaggon, Utilities, answering
*"Is it my imagination or do Sims not want to live near power lines?"*:

> *"Good catch. You are talking about the high-tension power lines that are big
> and ugly and take up a lot of space. Yes, they will lower an area's land
> value. Try to keep them away from Residential and Commercial zones."*

Land value had no idea power lines existed. A line now takes nine points off
the ground it stands on, falling away over two tiles, which puts a real cost on
running the grid straight through the nice part of town.

## The commute decides where a city grows, September 7

Two rules from the advisors' Q&A, neither of which the game had.

**A zone too far from what it needs does not develop.** Constance Lee, City
Planning: *"Sims don't like to travel too far. A Residential or Commercial zone
won't develop if it's beyond a reasonable commute distance from other zones.
But an Industrial zone on the outskirts of town could develop into a farm.
Transportation is the key; Sims may move in, but if the commute becomes
tiresome they'll move right back out."*

`traffic.js` already measured, every month, what share of each block's workers
found a job. Nothing read it. A block twenty tiles from the nearest workplace
grew exactly as fast as one across the street from the factories.

It now runs two extra searches over the same network the commuters use: from
every workplace outward, and from every home and border crossing outward. Each
zone tile keeps the cost of reaching what its kind needs - work for homes,
customers for shops, and the manual exempts industry, so industry is exempt.
Nothing in range at all is a hard stop, and the query card says which: *"No
work within a reasonable commute: nothing will be built here."* Within range
the distance is part of how good the address feels, so a far block builds out
slowly rather than not at all.

That signal is the distance, not the share of workers who landed a job. The
share depends on which block the assignment pass reached first, so gating on it
emptied neighbourhoods by tile index rather than by geography. The first
attempt did exactly that and the tunnel tests caught it.

**Bad traffic shortens the trip.** Moe Furstein, Transportation: *"Sims aren't
willing to drive as far if traffic is bad. That means that you are forced to
make a tiny congested city with no real hope for expansion... When mass transit
is introduced, Sims tend to get their cars off the road. Fewer cars means less
traffic and less traffic means Sims are willing to travel further."*

The trip limit was a fixed 40 tiles. It now runs from 40 down to 20, sliding
between average road traffic of 30 and 80: below 30 nobody notices, above 80
nobody will go far. The measurement is free, because the commuting model
already ran two passes - the first pass finds the routes on an empty map, and
what it measures then sets both the jams and the range for the second. Mass
transit needs no special case: riders on rail and subway are not on the roads,
so the traffic they do not make lengthens everyone's range.

Measured over 40 years from the sample town on three seeds, populations at year
40 were 17,070 / 15,690 against 17,050 / 15,470 before the change. A compact,
well-planned city loses nothing; the rule only bites on sprawl. A month on a
128x128 city costs 19.5ms.

## Petitioners bring the deals, September 7

Two rules, both about who does the approaching.

**Neighbour deals are offered, not shopped for.** The manual says so four
times, in four different chapters:

> *"When these connections are in place and the conditions are right (you have
> excess or insufficient resources or disposal means) the Mayor of the city
> your connection runs to will approach you via the Petitioners Meet window
> with terms for an import or export deal."*

> *"Mayors from neighboring cities may approach you from time to time with
> offers to sell power or water to you, or offers to pay you to supply them."*

> *"If you are generating excess power or water and you have the appropriate
> utilities connection in place, you may be approached by a neighbor looking
> to purchase these resources."*

> *"Look for Money-Making Neighbor Deals! If you have excess water, power, or
> garbage disposal capacity, check in the Petitioner window for neighbors who
> will pay you to supply these commodities."*

The game had a shop: four sides times three resources times buy or sell, all
available at any time from the Neighbours panel at a fixed list price. Now a
neighbouring mayor turns up as a petition when the connection is up **and** the
condition is right: short of power or water, or carrying more surplus than the
contract would take, or with uncollected garbage, or with disposal capacity
going spare. The Neighbours panel keeps the standing contracts and the cancel
button, and marks the rest *open to a deal*.

**The terms change from offer to offer.** *"Deals are updated periodically to
reflect both your city's and the neighboring city's needs."* The price swings
30% either way of the list rate and the cap 25%, so the same neighbour is worth
$150 a month on one call and $90 on the next. A signed contract then keeps the
price it was signed at: the terms live on the contract, not in the table, and
the billing, the metering, the garbage throughput and the cancellation penalty
all read them from there.

**A rejected petitioner sometimes leaves for good.** *"If you reject the offer,
the Petitioner leaves; sometimes they never come back."* One decline in three
is permanent, rolled once at the moment of refusal so reopening the window
cannot reroll it, and carried in the save. The rest stay away ten years, as
before.

Save version 6: contracts and petitions both carry more than they used to, and
both are validated on load - a save cannot invent a rate outside what an offer
could have been.

## Port zones, September 7

The largest structural gap left by the previous session. Airports and seaports
were buildings the mayor placed, one of each, at a fixed size. The manual is
explicit that they are neither:

> *"What actually builds in the Residential, Commercial, Industrial, Airport
> and Seaport zones is up to the Sims."*

> *"Just like RCI zones, you zone for airports and wait for Sims to develop
> them. Available in 1930, airports must be at least 3x5 tiles or larger in
> order to develop. They also require power, water and a road nearby. They
> will only develop as your city grows and requires outside sources for
> commerce and industry."*

> *"Seaports must be zoned at least 2x6 tiles or larger in order to develop...
> They must be located along a shoreline to do anything, but if you want to
> see real results, build one on a seacoast."*

`src/sim/ports.js` implements all of that. Both are now zone tools priced per
tile, in the Zones palette rather than Transport, with no density submenu.

**Footprint.** A port takes the largest rectangle of contiguous zone it can
find at one elevation, up to 8x8, and builds nothing at all below the
manual's minimum in either orientation. Unlike an RCI block it cannot fall
back to a smaller lot, so a zone that will never develop says why when
queried: too small, stepping up a hill, or waiting on power, water or a road.

**When.** Demand is measured against the sector the port serves: one tile of
airport carries 400 commercial jobs, one tile of seaport 300 industrial ones.
So the city wants its first minimum-size airport at about **6,000 commercial
jobs** and its first seaport at about **3,600 industrial jobs**, and wants
nothing before that. The anchor is the manual's minimum footprint; the jobs
per tile are calibrated, not recovered from the original game.

**Worth.** A working terminal lifts the sector it serves and, less, the other
one, because the manual names both sectors for both ports. The lift is capped
at 20 points per sector, which is what keeps the loop from running away: the
same commerce the airport grows is what decides whether more airport is
wanted. Measured over 40 years on a 64x64 coast map, a 5x6 airport and a 2x8
seaport took commercial jobs from 10,400 to 14,325 and then held steady, with
demand for more port settling at 16 and 43 out of 100.

**Trade.** *"Seaports and airports are considered connections to all
neighbors"*, and garbage travels by *"road, highway, rail, or seaport
connection"*. A standing seaport now opens garbage deals on every side, and
rail counts for garbage where before only roads did. That test reads only
persisted tile state, not this month's power: connections are derived before
the utility networks are, so a `powered` test there would come out differently
on load than in a running city.

A 5x6 airport employs 540 Sims and a 2x8 seaport 352, which is within a few
percent of the 500 and 350 the placed buildings carried. Save version 5.

## A grid is only as good as its own plants, September 7

The manual describes blackouts as a local thing:

> *"Areas of your city that draw power from an aging power plant may experience
> blackouts as the power plant loses capacity."*

The simulation already worked that way. Supply, demand and strain were all
computed per network. The figures handed to the player and to the advisors were
not: they were sums across every network in the city.

Seed 44, run forty years with the utilities kept in repair, shows what that
costs. At year 31 the town's one grid held 2,610 of supply against 2,552 of
demand, 98% and climbing as the gas plant aged. An orphan coal plant sat on its
own island network with 6,000 spare and nothing drawing on it. The headline read
8,610 against 2,552, so `u.power.demand > u.power.supply * 0.9` never fired and
Gus said everything was fine. Year 32 the grid crossed 101%, year 33 the plant
had been overdrawn for a year, and it exploded. Population went 18,390 → 4,490 →
750 → 140 → 0 with $5M in the bank and residential demand pegged at 100.

`updateUtilities` now reports the worst-off network alongside the totals: its
supply, its demand, its share of the city's draw, and a tile to go and look at.
Ranking is by shortfall, so the district that lost its plant outranks a small
grid running hot; with nothing short anywhere it falls back to whichever network
is closest to its limit. The advisor reads that instead of the sum, and names
the two causes Gus tells the player to tell apart:

> *"First, query the power plants to see how close to maximum capacity they have
> been running. You may need to place more power plants. If the plants seem
> fine, query tiles between the power plant and the location of the blackout to
> find a break in the line."*

A network with demand and no source is the break in the line; one over its
supply is the plant being too small. Cause is reported before symptom, so
"the grid around (4, 20) is drawing 103% of what its plants can make" comes
ahead of "only 48% of the city has power", which the mayor can already see and
which says nothing about where to stand.

The same city now gets five years of advisor warnings from year 29, and a news
line naming the plant nine months before it explodes: three months past capacity
is "a little while", twelve is "months on end". The mark is on the plant's own
`strain` counter, which already persisted, so it fires once per run of strain
and resets when the load comes off.

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
