"""Direct mesh creation for dense zone facades; fixed-building bakes stay unchanged.

Avoid repeated operator dependency-graph updates for thousands of window parts.
Objects still use the same materials, dimensions, bevels and weighted normals.
"""
import bpy, bmesh, math
from contextlib import contextmanager
import common


def solid(name,verts,faces,location,mat,bevel):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.location=location
    return common.finish(obj,mat,bevel)


def box(x,y,z,w,d,h,mat='ivory',bevel=.025):
    verts=[(a*w/2,b*d/2,c*h/2) for c in [-1,1] for b in [-1,1] for a in [-1,1]]
    return solid('zone block',verts,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)],(x+w/2,y+d/2,z+h/2),mat,min(bevel,min(w,d,h)*.3))


def cyl(x,y,z,r,h,mat='ivory',vertices=16,r2=None):
    top=r if r2 is None else r2
    verts=[(radius*math.cos(i*math.tau/vertices),radius*math.sin(i*math.tau/vertices),zz) for radius,zz in [(r,-h/2),(top,h/2)] for i in range(vertices)]
    faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    return solid('zone cylinder',verts,faces,(x,y,z+h/2),mat,.018)


def ball(x,y,z,r,mat='leaf',scale=(1,1,1),sub=2):
    data=bpy.data.meshes.new('zone foliage');bm=bmesh.new()
    bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r);bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new('zone foliage',data);bpy.context.collection.objects.link(obj)
    obj.location=(x,y,z);obj.scale=scale
    return common.finish(obj,mat)


def windows(x,y,z,w,d,height,step=.95,floors=2,arched=False):
    # Align openings to storeys; short homes must not push lintels through roofs.
    storey=height/floors
    for floor in range(floors):
        zz=z+floor*storey+storey*.24;wh=min(.9,storey*.62)
        for i in range(max(1,int(w/step))):
            xx=x+(i+.5)*w/max(1,int(w/step))
            common.window(xx,y,zz,h=wh,lit=(i+floor)%4==1,arch=arched)
            common.window(xx,y+d,zz,h=wh,side='back',lit=(i+floor)%4==2)
        for i in range(max(1,int(d/step))):
            yy=y+(i+.5)*d/max(1,int(d/step))
            common.window(x,yy,zz,h=wh,side='left',lit=(i+floor)%4==1)
            common.window(x+w,yy,zz,h=wh,side='right',lit=(i+floor)%4==2)


@contextmanager
def zone_primitives():
    original={name:getattr(common,name) for name in ['box','cyl','ball','windows']}
    try:
        for name in original:setattr(common,name,globals()[name])
        yield
    finally:
        for name,value in original.items():setattr(common,name,value)
