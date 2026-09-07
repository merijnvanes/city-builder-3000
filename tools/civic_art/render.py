"""Blender CLI entry: render physically lit, alpha-cut game sprites."""
import bpy, sys, os, math, json, argparse, time, importlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0,str(Path(__file__).parent))
import common
from contextlib import nullcontext
from fast_primitives import zone_primitives

p=argparse.ArgumentParser();p.add_argument('--types',default='fire');p.add_argument('--states',default='day');p.add_argument('--rotations',default='0');p.add_argument('--samples',type=int,default=32);p.add_argument('--scale',type=float,default=3);p.add_argument('--output',default='artifacts/civic-renders');p.add_argument('--save-blend',action='store_true')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
root=Path(__file__).resolve().parents[2];out=root/args.output;out.mkdir(parents=True,exist_ok=True)
registry=json.loads((Path(__file__).parent/'registry.json').read_text())
selected=list(registry) if args.types=='all' else [name for name,spec in registry.items() if spec['family']==args.types] if args.types in {spec['family'] for spec in registry.values()} else args.types.split(',')

def look(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

metadata_by_type={}
work=[(kind,i,variant['model']) for kind in selected for i,variant in enumerate(registry[kind].get('variants',[{'model':kind}]))]
for kind,variant,model in work:
    suffix=f'-v{variant}' if variant else ''
    started=time.time(); bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for collection in [bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.cameras,bpy.data.lights]:
        for block in list(collection):
            if block.users==0:collection.remove(block)
    common.M.clear();common.LIGHTS.clear();common.palette()
    footprint=registry[kind].get('footprint') or dict(w=registry[kind]['tiles'],h=registry[kind]['tiles'])
    width,depth=footprint['w'],footprint['h'];tiles=max(width,depth)
    with zone_primitives() if registry[kind].get('zone') else nullcontext():
        getattr(importlib.import_module(registry[kind]['module']),model)()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True;scene.render.use_persistent_data=True
    scene.cycles.max_bounces=5;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
    scene.render.resolution_percentage=100
    # Retain existing civic framing exactly. New families use measured bounds
    # at every view, so tall one-tile assets cannot clip their rotor or mast.
    bpy.context.view_layer.update()
    points=[obj.matrix_world@Vector(v) for obj in scene.objects if obj.type in ['MESH','FONT'] for v in obj.bound_box]
    target=Vector((0,0,2.3 if tiles<4 else 2.8))
    size=int(tiles*64*args.scale+112)
    if registry[kind]['family']!='civic':
        target.z=(min(p.z for p in points)+max(p.z for p in points))/2
        extent=0
        for rotation in range(4):
            a=math.radians(-45+rotation*90)
            right=Vector((-math.sin(a),math.cos(a),0))
            up=Vector((-.5*math.cos(a),-.5*math.sin(a),math.sqrt(3)/2))
            extent=max(extent,max(max(abs((p-target).dot(right)),abs((p-target).dot(up))) for p in points))
        size=max(size,math.ceil(2*extent*32*args.scale/(4/math.sqrt(2))+32))
        # Every authored solid stays within the catalog lot, including blades.
        for point in points:
            if abs(point.x)>width*2+.001 or abs(point.y)>depth*2+.001:
                raise ValueError(f'{kind}: geometry exceeds lot: {tuple(point)}')
    scene.render.resolution_x=size;scene.render.resolution_y=size
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.25
    world=bpy.data.worlds.new('soft studio sky');scene.world=world;world.use_nodes=True
    sky=world.node_tree.nodes.get('Background');sky.inputs['Color'].default_value=(.73,.82,1,1);sky.inputs['Strength'].default_value=.6
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=size/(32*args.scale/(4/math.sqrt(2)))
    bpy.ops.object.light_add(type='AREA',location=(-8,-12,18));key=bpy.context.object;key.data.energy=2100;key.data.shape='DISK';key.data.size=9;key.data.color=(1,.83,.63)
    bpy.ops.object.light_add(type='AREA',location=(10,3,12));fill=bpy.context.object;fill.data.energy=750;fill.data.size=12;fill.data.color=(.69,.82,1)
    look(key,(0,0,0));look(fill,(0,0,2))
    radius=25
    metadata=metadata_by_type.setdefault(kind,{'type':kind,**({'footprint':footprint} if 'footprint' in registry[kind] else {'tiles':tiles}),'scale':args.scale,'frames':{},'maxHeight':0})
    # Bounds are measured from the authored geometry, not hand-estimated.
    bpy.context.view_layer.update()
    for obj in scene.objects:
        if obj.type in ['MESH','FONT']:
            metadata['maxHeight']=max(metadata['maxHeight'],max((obj.matrix_world@Vector(v)).z for v in obj.bound_box)*math.sqrt(3/4)*32/(4/math.sqrt(2)))
    for state in args.states.split(','):
        night=state!='day';sky.inputs['Strength'].default_value=.16 if night else .6
        key.data.energy=330 if night else 2100;key.data.color=(.49,.65,1) if night else (1,.83,.63)
        fill.data.energy=170 if night else 750
        for node,strength in common.LIGHTS:node.inputs['Emission Strength'].default_value=strength if state=='night' else 0
        scene.view_settings.exposure=.15 if night else .25
        for rotation in map(int,args.rotations.split(',')):
            a=math.radians(-45+rotation*90)
            camera.location=target+Vector((math.cos(a)*radius,math.sin(a)*radius,radius*math.tan(math.radians(30))))
            look(camera,target)
            # Light remains upper-left in screen space for all map rotations.
            theta=rotation*math.pi/2;c,s=math.cos(theta),math.sin(theta)
            for light,original in [(key,(-8,-12,18)),(fill,(10,3,12))]:
                x,y,z=original;light.location=(x*c-y*s,x*s+y*c,z);look(light,(0,0,1))
            bpy.context.view_layer.update()
            anchor=world_to_camera_view(scene,camera,Vector((0,0,0)))
            name=f'{kind}-{state}-{rotation}{suffix}.png';scene.render.filepath=str(out/name)
            bpy.ops.render.render(write_still=True)
            metadata['frames'][f'{state}-{rotation}{suffix}']={'file':name,'width':size,'height':size,'anchor':[anchor.x*size,(1-anchor.y)*size]}
            print('ASSET_RENDERED',name,round(time.time()-started,1),flush=True)
    (out/f'{kind}.json').write_text(json.dumps(metadata,indent=2))
    if args.save_blend:bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{kind}{suffix}.blend'),compress=True)
