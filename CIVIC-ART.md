# Civic architecture

All twelve entries in the catalog's `civic` group have dedicated procedural
Canvas artwork. Simulation behavior and construction costs are unchanged.

| Building | Visual identity |
| --- | --- |
| Police station | Navy precinct, gold roof shield, radio aerial and patrol cars |
| Fire station | Vermilion engine bays, ladder trucks and tall hose tower |
| Jail | Barred cell block, fenced exercise yard and glazed watchtower |
| Hospital | White and teal stepped ward, medical crosses, red emergency canopy and ambulances |
| School | Terracotta schoolhouse, clock turret, playground swings and yellow school bus |
| College | Brick quadrangle, copper roofs, ceremonial gate and tall clock tower |
| Library | Paired teal roofs, open-book roof sign and reading benches |
| Museum | Limestone colonnade, glass pyramid, exhibition banners and sculpture forecourt |
| Landfill | Layered refuse cells and yellow compactor |
| Incinerator | Brick furnace hall, twin orange-banded stacks and loading hopper |
| Recycling center | Green sawtooth roof, reuse arrows and four sorting containers |
| Waste-to-energy plant | Teal turbine hall, lightning emblem, striped stack and transformers |

Art lives in `src/civic-services-art.js`, `src/civic-culture-art.js` and
`src/civic-sanitation-art.js`; small architectural details live in
`src/civic-details.js`. Ground is drawn first, independent structures use
camera-sorted parts, and facade markings are limited to visible walls.
Building heights in `src/building-art.js` cover the new silhouettes.

To inspect all models, run Vite, then:

```sh
CIVIC_TEST_URL=http://127.0.0.1:4173 node tests/civic-art.mjs
node --test tests/civic-art.test.js
```

The browser script writes contact sheets to `artifacts/civic-overview.png`,
`civic-rotations.png`, `civic-night.png` and `civic-unpowered.png`.
The geometry tests check lot bounds, height bounds and hidden medical emblems.
