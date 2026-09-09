# Transport architecture

Three standalone transport buildings and seventeen port modules use original
scripted Blender models and transparent offline WebP sprites. Roads, rails,
subway tracks, highways, ramps and tunnel bores retain their separate network
rendering.

| Type | Footprint | Identity |
| --- | --- | --- |
| bus | 1×1 | Open glass shelter, sheltered bench, timetable and boarding edge |
| railstation | 2×2 | Brick ticket hall, clock gable and butterfly platform canopy |
| substation | 1×1 | Subway stairwell, handrails, ticket machine and metro portal |

## Port modules

An airport or seaport zone is filled by the Sims one module at a time
(`src/sim/port-layout.js`). Each module is a lot whose anchor carries `part`,
and its sprite is keyed `type-part`. Runway, apron, quay and container pieces
paint their whole lot with no kerb so they tile edge to edge; buildings keep
the collection's ivory kerb.

| Key | Footprint | Identity |
| --- | --- | --- |
| airport-runway-x / -y | 1×1 | Asphalt strip with centreline dashes, edge lines and edge lights, along either axis |
| airport-threshold-x / -y | 1×1 | The same strip with threshold bars, symmetric so one model serves both ends |
| airport-terminal | 2×2 | Glazed hall, cantilevered concourse, jet bridge, landside forecourt |
| airport-tower | 1×1 | Tapered shaft, glazed control cab, radar mast and beacon |
| airport-hangar | 2×2 | Steel maintenance hangar with full-height sliding doors onto its apron |
| airport-cargo | 1×1 | Freight shed with roller door and pallets |
| airport-fuel | 1×1 | Three white tanks inside a bund wall |
| airport-apron | 1×1 | Taxiway paving with yellow guide lines and blue edge lights |
| seaport-warehouse | 2×2 | Brick transit shed with three loading doors |
| seaport-quay | 1×1 | Paved quay with bollards on every edge and a mobile harbour crane |
| seaport-pier | 1×1 | Timber deck on piles standing in zoned water |
| seaport-gantry | 2×2 | Rail-mounted gantry crane over stacked containers |
| seaport-office | 1×1 | Two-storey harbour office with a flag |
| seaport-tanks | 1×1 | Two storage tanks with catwalks and pipework |
| seaport-containers | 1×1 | Stacked containers in three colour arrangements (`floor(seed * 3)`) |

Sources are `tools/civic_art/transport.py` and `transport_ports.py`. Registry
keys with dashes name their Python model with `model`. Twenty layouts produce
240 frames across four views and daylight, powered night and unpowered night.
The pier's lot origin is the water surface; its piles continue below it, and
the game stands the sprite on the water level rather than on a graded pad.

Run `npm run art:transport` for complete rendering and incremental packaging,
or bake the port pieces alone:

```sh
KEYS=$(python3 -c "import json;r=json.load(open('tools/civic_art/registry.json'));print(','.join(k for k,v in r.items() if v.get('module')=='transport_ports'))")
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types $KEYS --states day,night,unpowered --rotations 0,1,2,3 --samples 32 --device METAL
python3 tools/civic_art/package.py --types $KEYS
```

Inspect `/civic-gallery.html?family=transport` at game size and close up, and
a developed airport and harbour in the game in every rotation. `npm run
test:art-contract` checks metadata coverage and packaging; the transport
family has an 8 MiB compressed ceiling.
