# World lighting and receiving shadows

The camera views one stationary city and sun. Turning the view changes the
screen direction of a shadow, but not the land or building surfaces it covers.
The sun is off at night; authored night illumination remains visible.

## Findings and references

The previous renderer put every building shadow on the ground layer, then
covered it with opaque artwork. It also chose different screen-space shadow
directions for procedural and imported buildings. The Blender exporter rotated
its key and fill lights with each camera angle. Fixing only the runtime offset
would have left the imported facades and baked self-shadows pointing the wrong way.

A receiving surface must participate in the lighting calculation. Unity's
[shadow-mapping documentation](https://docs.unity.cn/Manual/shadow-mapping.html)
describes testing how far light can travel before hitting a surface; NVIDIA's
[shadow-volume discussion](https://developer.nvidia.com/gpugems/gpugems/part-ii-lighting-and-shadows/chapter-15-managing-visibility-pixel-lighting)
describes extruding occluders along the light vector. Both work in scene space,
independently of the viewer. Full depth/normal rendering is another option:
[Blender documents these passes](https://docs.blender.org/manual/en/4.5/render/layers/passes.html).
Here, simplified shadow volumes fit the existing Canvas renderer and bounded
sprite loader without adding a second renderer or full-resolution depth textures.

## Implementation

- `src/sunlight-config.json` defines the model-space light shared with Blender.
  The exporter uses a directional sun and keeps both lights stationary across
  the four camera views, including for towers taller than the light origin.
  Packaged frames record `lighting: world-v1`; all existing variants and states
  are rebuilt to the same convention. Procedural walls, cylinders, foundation
  walls and tree highlights also use the world light.
- `sunlight.js` eliminates the ray parameter from a ray/box intersection to
  derive convex shadow-volume half-spaces. It clips receiving terrain, roof
  and wall polygons against these planes, including the caster's height cap.
  A low building therefore cannot darken a roof above it.
- `shadow-scene.js` spatially indexes simplified building bodies, tree crowns
  utility poles and elevated transport decks. It includes off-screen casters and invalidates on a city
  revision or terrain-mesh replacement, not on camera motion.
- Terrain shadows are clipped to each actual receiving tile, including level
  water, graded building sites, retaining walls and bridge decks. They cannot escape the map.
  World-space intersections are cached across camera movement.
  Foundation geometry includes its full shell to seal terraced corners; only
  camera-facing wall surfaces receive the visible shadow pass.
- Building shadows use a ground pad plus two visible walls and a roof. A raised
  receiver replaces the ground shadow behind it. The result is composited on
  an isolated, reusable scratch surface with the artwork's alpha; using
  `source-atop` on the whole city would corrupt earlier buildings through gaps.
  Overlapping casters form one shadow mask, rather than repeated darkening.
  Tree canopies also receive shadows from buildings.
- Two scratch canvases are reused, bounded by viewport size. A single shared
  atlas caches finished composites for panning, capped at 16 MiB (smaller on
  smaller viewports). It keeps no references to decoded source frames; the
  existing 32 MiB source-image limit remains unchanged. Unseen slots are
  reclaimed and overflow draws normally. Picking samples the composite's atlas
  rectangle, preserving alpha without per-building shadow canvases. Scene or
  artwork changes invalidate the atlas, as do rotation, zoom and pixel phase.

This is intentionally approximate shadow geometry. Bounding bodies do not
resolve every courtyard, antenna, gutter, branch or roof pitch. The artwork's
baked self-shading supplies fine detail; dynamic shadows supply relationships
between separate objects. New asset types automatically participate through
the existing lot footprint and measured height contract.

The foundation pad and skirt replace the terrain surface inside each lot.
Buried slope tiles and their grid lines must not be painted: later tiles can
otherwise cut through the far retaining wall. A browser regression changes
only buried terrain and checks that every rendered ground pixel stays unchanged
in all four views. It also changes the exterior terrain and checks that pixels
inside the exposed retaining faces remain unchanged.

The skirt draws rear faces before visible faces. At a lowered corner, the two
faces overlap on screen below the pad; drawing a rear face last puts its shade
across the visible wall. An isolated browser test checks the wall's exact color
at all four lowered corners in every rotation, without terrain or cast shadows.
The city-renderer test also checks exact wall colors after the terrain and tool
grid pass, using a 3x3 lot and eight side or diagonal neighbor layouts in every
rotation. Cast shadows are disabled for that color check.

A foundation is part of its building's scene item. The pad and walls are
painted into the object layer immediately before the architecture, so the site
and its building hide rear objects together, and the buried terrain beneath is
plain ground that the pad covers. The same holds for every raised thing: bridge
and highway decks, ramps and tunnel mouths are items too, never ground. See
`src/scene-items.js` for the rule. Overlapping footprints are ordered by their
separating world axis; a large lot's front corner alone cannot order trees
beside its far half. This follows the same need to interleave terrain and
objects described in Unity's [individual tile rendering mode](https://docs.unity.cn/Manual/Tilemap-Isometric-RenderModes.html).
Picking follows the same foundation polygons, so rear artwork cannot be
selected through a retaining wall. Natural trees use their foliage atlas alpha
for picking, including when their shaded draw comes from the scene cache.
Visible foreground trees therefore select their own tile. The scene regression
checks actual rear trees and cached buildings, plus all four diagonal corners
in each view.

## Validation

`pnpm test:shadows` checks world-space rotation invariance, height-aware roof and
wall intersections, imported and procedural pixel receiving, unchanged alpha,
and map-edge clipping. `pnpm test:performance` measures redraw and cached-frame
cost with a single benchmark scene. Also run the general browser workflow and
architecture cache tests after changing composition or cache ownership.

For visual testing, place a tall building beside a lower one and turn the view
four times. The shadow should remain on the same side of the same property;
roof and wall shading must follow their own height, and transparent gaps must
remain clear. Check a coastal site, neighboring terraced plots and a tree beside
a building as well.
