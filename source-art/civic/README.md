# Civic asset art direction

The civic buildings establish the production visual standard for the city.
They are original, editable 3D models built from the Python sources in
`tools/civic_art/`, then lit and rendered offline with Blender. The browser
receives transparent WebP images, not 3D scenes.

## Visual principles

- Warm, carefully made miniature architecture. Beveled edges, recessed glazing,
  masonry reveals, layered cornices, roof seams, and soft contact shadows.
- Recognition starts with the building's silhouette and architectural type.
  Signs and props reinforce it; they cannot rescue an anonymous building.
- Distinct campuses: Art Deco precinct, brick firehouse, modern hospital,
  schoolhouse, collegiate quadrangle, vaulted library, domed museum, and
  visibly different industrial processes.
- Compose the grounds for their actual use. A fire apron, reading terrace,
  healing garden, playground, cloister and loading yard should look different.
- No mandatory prop checklist. This set deliberately includes no parked vehicles.
- Concentrate detail around entries and rooflines. Large material areas remain
  quiet and readable at the normal city zoom.
- Warm limestone and restrained metalwork unite the set; masonry, copper,
  terracotta, glazing and steel give individual buildings their own character.

For other building families, coverage and integration requirements are tracked in
[ASSET-WORKFLOW.md](../../ASSET-WORKFLOW.md). It also documents preview isolation
and the visual checks required before shipping.

## Source and export

Civic model sources: `common.py`, `services.py`, `culture.py`, `sanitation.py`.
The shared registry and power-family sources are documented in [POWER-ART.md](../../POWER-ART.md).
Water sources and export commands are documented in [WATER-ART.md](../../WATER-ART.md).
Park sources and export commands are documented in [PARKS-ART.md](../../PARKS-ART.md).
`render.py` owns the exact 2:1 ground projection, consistent screen-relative
lighting, four rotations, and day / powered night / unpowered night states.
`package.py` exports alpha-cropped WebP with screen anchors and measured heights.

Run `npm run art:civic` for a complete initial bake, using Blender 5.1 and
Python with Pillow. Afterward, rebuild an individual building from the repository root:

```sh
blender --background --factory-startup --python tools/civic_art/render.py -- \
  --types fire --states day,night,unpowered --rotations 0,1,2,3 --samples 32 \
  --save-blend
python3 tools/civic_art/package.py --types fire
```

`--save-blend` writes an editable `.blend` into the render output directory for inspection. Generated render
intermediates live in ignored `artifacts/civic-renders/`. Packaged runtime images
live in `public/assets/civic/`, with generated metadata in
`src/civic-sprite-manifest.js`. Building scripts are the source of truth.

The render script uses system Arial Bold for tiny architectural signs when
available, otherwise Blender’s built-in font. Set `CIVIC_ART_FONT` to use another
local font. Lettering is baked into image pixels; no font file is distributed.
