# Civic architecture

The twelve civic buildings use original Blender models baked into transparent
WebP sprites. Their editable model sources and art direction are documented in
[source-art/civic/README.md](source-art/civic/README.md).

Each building has four camera angles and three lighting states: daylight,
powered night, and unpowered night. The 144 sprites total about 2.82 MiB.
No 3D library or model data is loaded by the browser.

| Building | Architectural identity |
| --- | --- |
| Police station | Art Deco limestone precinct, bronze shield and blue glazed entrance |
| Fire station | Brick firehouse, deep engine portals, slate dormers and hose tower |
| Jail | County entrance lodge, barred cell block and secure exercise courtyard |
| Hospital | Modern ward, glazed circulation drum and sheltered emergency entry |
| School | Brick schoolhouse, bell cupola, play garden and raised learning beds |
| College | Collegiate quadrangle, four-sided clock tower, cloisters and courtyard fountain |
| Library | Copper-vaulted reading room, timber archive wing and reading terrace |
| Museum | Limestone colonnade, copper rotunda and sculpture forecourt |
| Landfill | Managed earth cells, refuse materials and retaining walls |
| Incinerator | Brick furnace hall, tapering stacks, clerestories and service ducts |
| Recycling center | Folded green roof, glazed clerestories and separate sorting bays |
| Waste-to-energy plant | Blue boiler hall, turbine gallery and district-heating pipes |

Vehicles are deliberately absent. Architecture and campus composition carry
recognition; context is specific to each building's use.

## Browser rendering

`src/civic-sprites.js` loads only requested frames, shares one decoded canvas
between instances, and retains images within a 32 MiB LRU budget. Current views
are preferred over inactive angles during eviction. A civic lot takes one
`drawImage` call, including all material details, scenery and baked shadows.
Temporary procedural fallback canvases are released when production assets load.
Failed requests keep the fallback available without a request loop.

Measured heights and per-frame pixel anchors preserve projection, terrain
placement, shadow bounds and alpha-based picking. Inspection portraits refresh
after asynchronous loads. Asset URLs support deployment under a subdirectory.

## Inspect and validate

Open `/civic-gallery.html` on the running app to compare game scale, close-ups,
lighting states and all four camera angles. This page uses the actual assets
shipped with the production build.

With Vite running:

```sh
CIVIC_TEST_URL=http://127.0.0.1:4175 npm run test:civic
CIVIC_TEST_URL=http://127.0.0.1:4175 npm run test:visuals
CIVIC_TEST_URL=http://127.0.0.1:4175 npm run test:performance
```

The civic suite verifies catalog completeness, compressed size, cold-load
redraw, release of fallback canvases, shared image reuse, a single blit per
instance, distinct rotation/lighting states, alpha picking and bounded decoded
memory. It also exports visual contact sheets in `artifacts/`.

## Validation snapshot

Validated in local Chrome on 2026-09-07: 302 Node tests, the civic asset suite,
640 direct/cached rendering comparisons, the full gameplay browser smoke test,
and the production build hosted beneath `/nested/` all passed. The asset suite
also checks automatic portrait refresh, active-view retention during cache
churn, and Retina alpha picking in all four rotations.

The existing 1440×1000 renderer benchmark measured cached-frame CPU p95 of
0.8 ms for the 64×64 city and 1.2 ms for the 128×128 city. Browser frame intervals
were about 16.7–16.8 ms. Camera redraw p95 ranged from 12.2 to 21.2 ms. These are
local measurements with warm caches, not a cross-device performance guarantee.
