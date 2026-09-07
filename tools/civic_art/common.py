"""Editable, world-scale architectural modeling primitives. One tile is 4 m."""
import bpy, math, random, os
from mathutils import Vector

M = {}
LIGHTS = []

def material(name, color, rough=.6, metal=0, emission=0, texture=None):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1); p.inputs['Emission Strength'].default_value = emission
        LIGHTS.append((p, emission))
    if texture:
        n = m.node_tree.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 55 if texture == 'stone' else 8
        bump = m.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .18; bump.inputs['Distance'].default_value = .045
        m.node_tree.links.new(n.outputs['Fac'], bump.inputs['Height']); m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
        ramp = m.node_tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*(v*.8 for v in color), 1)
        ramp.color_ramp.elements[1].color = (*(min(1,v*1.12) for v in color), 1)
        m.node_tree.links.new(n.outputs['Fac'], ramp.inputs[0]); m.node_tree.links.new(ramp.outputs[0], p.inputs['Base Color'])
    if name in ['brick','bricklight']:
        nodes=m.node_tree.nodes;links=m.node_tree.links
        coords=nodes.new('ShaderNodeTexCoord');sep=nodes.new('ShaderNodeSeparateXYZ');links.new(coords.outputs['Object'],sep.inputs[0])
        add=nodes.new('ShaderNodeMath');add.operation='ADD';links.new(sep.outputs['X'],add.inputs[0]);links.new(sep.outputs['Y'],add.inputs[1])
        uv=nodes.new('ShaderNodeCombineXYZ');links.new(add.outputs[0],uv.inputs['X']);links.new(sep.outputs['Z'],uv.inputs['Y'])
        brick=nodes.new('ShaderNodeTexBrick');links.new(uv.outputs[0],brick.inputs['Vector'])
        brick.inputs['Scale'].default_value=1;brick.inputs['Mortar Size'].default_value=.009;brick.inputs['Brick Width'].default_value=.36;brick.inputs['Row Height'].default_value=.15
        brick.inputs['Color1'].default_value=(*(v*.82 for v in color),1);brick.inputs['Color2'].default_value=(*(min(1,v*1.12) for v in color),1);brick.inputs['Mortar'].default_value=(.34,.28,.21,1)
        links.new(brick.outputs['Color'],p.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24;bump.inputs['Distance'].default_value=.025
        links.new(brick.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
    M[name] = m
    return m

def palette():
    for name, col, texture in [
        ('ivory',(.83,.75,.58),'stone'), ('cream',(.94,.86,.68),'stone'), ('brick',(.47,.16,.09),'stone'),
        ('bricklight',(.66,.29,.17),'stone'), ('clay',(.55,.19,.1),'stone'), ('slate',(.055,.105,.14),None),
        ('copper',(.10,.31,.29),'stone'), ('blue',(.055,.19,.29),None), ('teal',(.08,.34,.36),None),
        ('red',(.65,.065,.04),None), ('gold',(.84,.52,.12),None), ('white',(.91,.91,.81),None),
        ('asphalt',(.14,.18,.19),'stone'), ('paving',(.60,.59,.51),'stone'), ('path',(.75,.67,.51),'stone'),
        ('grass',(.28,.40,.17),'stone'), ('soil',(.23,.17,.1),'stone'), ('wood',(.34,.19,.09),'stone'),
        ('hedge',(.095,.24,.105),None), ('leaf',(.26,.43,.16),None), ('leaflight',(.46,.55,.19),None),
        ('leafdark',(.10,.29,.18),None), ('purple',(.36,.12,.24),None), ('yellow',(.95,.66,.13),None),
        ('steel',(.31,.39,.40),None), ('dark',(.018,.038,.044),None), ('water',(.13,.43,.43),None),
    ]: material(name,col,texture=texture)
    material('glass',(.07,.22,.27),rough=.18,metal=.3)
    material('glasslight',(.18,.39,.43),rough=.23,metal=.2)
    material('lamp',(.98,.57,.21),rough=.3,emission=3)
    material('windowlit',(.88,.57,.26),rough=.28,emission=1.4)
    material('silver',(.55,.63,.64),rough=.25,metal=.65)


def finish(obj, mat, bevel=0):
    obj.data.materials.append(M[mat] if isinstance(mat,str) else mat)
    if bevel:
        mod=obj.modifiers.new('crafted edges','BEVEL'); mod.width=bevel; mod.segments=2
        mod=obj.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
    return obj

def box(x,y,z,w,d,h,mat='ivory',bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x+w/2,y+d/2,z+h/2))
    o=bpy.context.object; o.scale=(w,d,h); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,mat,min(bevel,min(w,d,h)*.3))

def mesh(name, verts, faces, mat):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); return finish(obj,mat)

def cyl(x,y,z,r,h,mat='ivory',vertices=16,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=h,location=(x,y,z+h/2))
    return finish(bpy.context.object,mat,.018)

def beam(a,b,r=.035,mat='steel'):
    a,b=Vector(a),Vector(b); delta=b-a
    o=cyl(*(a+b)/2-Vector((0,0,delta.length/2)),r,delta.length,mat,10)
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return o

def ball(x,y,z,r,mat='leaf',scale=(1,1,1),sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=(x,y,z))
    o=bpy.context.object; o.scale=scale; return finish(o,mat)

def roof(x,y,z,w,d,rise,mat='slate'):
    # Ridge runs along Y, solid gable ends, separately modeled verge and gutter.
    verts=[(x,y,z),(x+w,y,z),(x+w,y+d,z),(x,y+d,z),(x+w/2,y,z+rise),(x+w/2,y+d,z+rise)]
    mesh('pitched roof',verts,[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2),(0,3,2,1)],mat)
    for a,b in [(verts[0],verts[4]),(verts[4],verts[1]),(verts[3],verts[5]),(verts[5],verts[2])]: beam(a,b,.055,'cream')
    for side in [0,1]:
        xx=x+side*w
        beam((xx,y,z),(xx,y+d,z),.045,'slate')
        # Raised standing seams catch light without texture noise at city zoom.
        for i in range(1,max(2,int(d/.36))):
            yy=y+i*d/max(2,int(d/.36))
            beam((xx,yy,z+.018),(x+w/2,yy,z+rise+.018),.012,mat)
    beam(verts[4],verts[5],.06,mat)

def hip(x,y,z,w,d,rise,mat='copper'):
    mesh('hip roof',[(x,y,z),(x+w,y,z),(x+w,y+d,z),(x,y+d,z),(x+w/2,y+d/2,z+rise)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)],mat)
    for a,b in [((x,y,z),(x+w,y,z)),((x+w,y,z),(x+w,y+d,z)),((x+w,y+d,z),(x,y+d,z)),((x,y+d,z),(x,y,z))]: beam(a,b,.04,mat)

def dome(x,y,z,r,h,mat='copper'):
    seg=24; rings=8; verts=[]
    for j in range(rings+1):
        a=j/rings*math.pi/2
        for i in range(seg):
            theta=i/seg*math.tau; verts.append((x+r*math.cos(a)*math.cos(theta),y+r*math.cos(a)*math.sin(theta),z+h*math.sin(a)))
    mesh('copper dome',verts,[(j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i) for j in range(rings) for i in range(seg)],mat)
    for i in range(0,seg,3):
        theta=i/seg*math.tau
        for j in range(rings):
            a=j/rings*math.pi/2;b=(j+1)/rings*math.pi/2
            beam((x+r*math.cos(a)*math.cos(theta),y+r*math.cos(a)*math.sin(theta),z+h*math.sin(a)),(x+r*math.cos(b)*math.cos(theta),y+r*math.cos(b)*math.sin(theta),z+h*math.sin(b)),.018,mat)

FONT=None
def text(body,x,y,z,size=.25,mat='cream',face='front'):
    global FONT
    if FONT is None:
        path=os.environ.get('CIVIC_ART_FONT','/System/Library/Fonts/Supplemental/Arial Bold.ttf')
        FONT=bpy.data.fonts.load(path) if os.path.isfile(path) else bpy.data.fonts.get('Bfont')
    data=bpy.data.curves.new('architectural lettering','FONT'); data.body=body; data.align_x='CENTER'; data.align_y='CENTER'; data.size=size; data.extrude=.003;data.font=FONT
    o=bpy.data.objects.new(body,data);bpy.context.collection.objects.link(o);o.location=(x,y,z)
    if face=='front': o.rotation_euler=(math.pi/2,0,0)
    elif face=='back':o.rotation_euler=(math.pi/2,0,math.pi)
    elif face=='right':o.rotation_euler=(math.pi/2,0,math.pi/2)
    finish(o,mat);return o

def window(x,y,z,w=.48,h=.82,side='front',lit=False,arch=False):
    # Dark recessed aperture framed by dimensional stone reveals and mullions.
    def b(xx,yy,zz,ww,dd,hh,mat,bev=.01):
        if side in ['front','back']: return box(x+xx,y+(yy if side=='front' else -yy-dd),z+zz,ww,dd,hh,mat,bev)
        return box(x+(yy if side=='left' else -yy-dd),y+xx,z+zz,dd,ww,hh,mat,bev)
    b(-w/2,-.055,-.04,w,.1,h+.08,'cream')
    b(-w/2+.045,-.075,.01,w-.09,.06,h-.02,'dark')
    b(-w/2+.07,-.081,.035,w-.14,.016,h-.08,'windowlit' if lit else 'glasslight')
    b(-.018,-.10,.02,.036,.05,h-.04,'cream')
    b(-w/2+.035,-.10,h*.52,w-.07,.05,.035,'cream')
    b(-w/2-.045,-.15,-.055,w+.09,.23,.085,'ivory')
    if arch:
        # Curved fanlight gives the arched masonry opening a distinct rhythm.
        points=[]
        for i in range(13):
            a=i/12*math.pi; points.append((x+math.cos(a)*w*.52,y-.12,z+h+math.sin(a)*w*.4))
        for a,bp in zip(points,points[1:]):beam(a,bp,.048,'cream')

def windows(x,y,z,w,d,height,step=.95,floors=2,arched=False):
    for floor in range(floors):
        zz=z+.48+floor*(height-.35)/floors
        for i in range(max(1,int(w/step))):
            xx=x+(i+.5)*w/max(1,int(w/step))
            window(xx,y,zz,side='front',h=min(.9,height/floors-.35),lit=(i+floor)%4==1,arch=arched)
            window(xx,y+d,zz,side='back',h=min(.9,height/floors-.35),lit=(i+floor)%4==2)
        for i in range(max(1,int(d/step))):
            yy=y+(i+.5)*d/max(1,int(d/step))
            window(x,yy,zz,side='left',h=min(.9,height/floors-.35),lit=(i+floor)%4==1)
            window(x+w,yy,zz,side='right',h=min(.9,height/floors-.35),lit=(i+floor)%4==2)

def building(x,y,z,w,d,h,mat='brick',floors=2,pitched=True,roofmat='slate'):
    box(x-.06,y-.06,z,w+.12,d+.12,.22,'ivory')
    box(x,y,z+.22,w,d,h-.22,mat)
    box(x-.07,y-.07,z+h-.16,w+.14,d+.14,.18,'cream')
    windows(x,y,z,w,d,h,floors=floors)
    if pitched:roof(x-.16,y-.16,z+h,w+.32,d+.32,min(w*.35,1.5),roofmat)
    else:
        box(x-.09,y-.09,z+h,w+.18,d+.18,.14,'cream')
        box(x+.08,y+.08,z+h+.14,w-.16,d-.16,.055,'slate')
        for xx in [x,x+w-.09]:box(xx,y,z+h+.14,.09,d,.22,'ivory')
        for yy in [y,y+d-.09]:box(x,yy,z+h+.14,w,.09,.22,'ivory')


def tree(x,y,z=.12,size=1,seed=0):
    rng=random.Random(seed)
    cyl(x,y,z,.065*size,1.1*size,'wood',8)
    for i in range(6):
        a=i*2.4; rr=.27*size
        ball(x+math.cos(a)*rr,y+math.sin(a)*rr,z+(1.05+rng.random()*.65)*size,.48*size,['leaf','leaflight','leafdark'][i%3],scale=(1,1,1.2))

def planter(x,y,w=.65,d=.5,flowers=False):
    box(x,y,.12,w,d,.26,'ivory',.05);box(x+.05,y+.05,.38,w-.1,d-.1,.025,'soil')
    for i in range(max(2,int(w/.18))):
        xx=x+.13+i*(w-.26)/max(1,int(w/.18)-1)
        ball(xx,y+d/2,.49,.17,'hedge')
        if flowers:ball(xx,y+d/2,.64,.085,['purple','yellow','white'][i%3])

def bench(x,y,angle=0):
    before=set(bpy.context.scene.objects)
    for xx in [-.4,.4]:
        box(x+xx-.035,y,.15,.07,.35,.35,'slate');box(x+xx-.035,y+.3,.45,.07,.055,.4,'slate')
    for j in range(3):box(x-.5,y+j*.115,.5,1,.09,.055,'wood')
    for j in range(2):box(x-.5,y+.32,.61+j*.15,1,.055,.1,'wood')
    if angle:
        for obj in set(bpy.context.scene.objects)-before:
            rel=obj.location-Vector((x,y,0));c,s=math.cos(angle),math.sin(angle);obj.location=(x+rel.x*c-rel.y*s,y+rel.x*s+rel.y*c,rel.z);obj.rotation_euler.z+=angle

def lamp(x,y,h=1.8):
    cyl(x,y,.12,.06,.15,'slate');cyl(x,y,.12,.025,h,'slate');box(x-.09,y-.09,h,.18,.18,.22,'lamp');hip(x-.13,y-.13,h+.22,.26,.26,.13,'slate')

def base(size=12,mat='grass'):
    s=size/2
    box(-s+.1,-s+.1,-.12,size-.2,size-.2,.24,'ivory',.09)
    box(-s+.22,-s+.22,.08,size-.44,size-.44,.08,mat,.025)

def paving(x,y,w,d,mat='paving',z=.16):
    box(x,y,z,w,d,.04,mat,.015)
    if mat!='asphalt':
        for i in range(1,int(w/.5)): box(x+i*.5,y,z+.04,.012,d,.003,'ivory',0)
        for i in range(1,int(d/.5)): box(x,y+i*.5,z+.04,w,.012,.003,'ivory',0)

def fence(x,y,w,d,h=1,mat='slate'):
    a,b=(x,y),(x+w,y+d);length=math.hypot(w,d);n=max(1,int(length/.35))
    for i in range(n+1):
        xx=x+w*i/n;yy=y+d*i/n;beam((xx,yy,.2),(xx,yy,.2+h),.018,mat)
    for z in [.42,.2+h]:beam((*a,z),(*b,z),.025,mat)

def clock(x,y,z,r=.35,face='front'):
    before=set(bpy.context.scene.objects)
    o=cyl(x,y,z,r,.065,'cream',32);o.rotation_euler.x=math.pi/2
    beam((x,y-.05,z+.032),(x,y-.055,z+r*.67),.018,'slate')
    beam((x,y-.05,z+.032),(x+r*.5,y-.055,z+.032),.018,'slate')
    for i in range(12):
        a=i*math.tau/12;beam((x+math.sin(a)*r*.81,y-.06,z+math.cos(a)*r*.81),(x+math.sin(a)*r*.9,y-.06,z+math.cos(a)*r*.9),.008,'gold')

    angle={'front':0,'back':math.pi,'left':-math.pi/2,'right':math.pi/2}[face]
    if angle:
        for obj in set(bpy.context.scene.objects)-before:
            rel=obj.location-Vector((x,y,z));c,s=math.cos(angle),math.sin(angle)
            obj.location=(x+rel.x*c-rel.y*s,y+rel.x*s+rel.y*c,z+rel.z);obj.rotation_euler.z+=angle

def door(x,y,z=.2,w=.85,h=1.6,mat='blue'):
    box(x-w/2-.1,y-.09,z,w+.2,.12,h+.12,'ivory')
    box(x-w/2,y-.115,z,w,.05,h,mat)
    for dx in [-w*.25,w*.25]:
        box(x+dx-w*.18,y-.15,z+.62,w*.36,.026,h-.75,'glasslight')
        beam((x+dx,y-.18,z+.65),(x+dx,y-.18,z+.9),.012,'gold')
    box(x-.025,y-.18,z,.05,.025,h,'ivory')

def stair(x,y,w,n=4):
    for i in range(n):box(x,y+i*.22,.16,w,.22,(i+1)*.09,'ivory')
