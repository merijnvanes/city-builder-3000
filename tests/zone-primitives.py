"""Run with Blender: geometry winding and scoped fixed-art isolation."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools/civic_art'))
import bpy,bmesh,common
from fast_primitives import zone_primitives
common.palette()
original={name:getattr(common,name) for name in ['box','cyl','ball','windows']}
with zone_primitives():
    cube=common.box(2,3,4,1,2,3)
    bm=bmesh.new();bm.from_mesh(cube.data)
    assert abs(bm.calc_volume(signed=True)-6)<1e-6
    bm.free()
    assert tuple(cube.location)==(2.5,4,5.5)
    cylinder=common.cyl(1,2,3,.5,2)
    bm=bmesh.new();bm.from_mesh(cylinder.data)
    assert bm.calc_volume(signed=True)>1.5
    bm.free()
assert all(getattr(common,name) is value for name,value in original.items())
try:
    with zone_primitives():raise RuntimeError('deliberate model failure')
except RuntimeError:pass
assert all(getattr(common,name) is value for name,value in original.items())
print('Zone primitive dimensions, outward winding and fixed-art isolation pass.')
