"""Shared industrial construction details for the authored power collection."""
from common import *


def yard(tiles=4, grass=False):
    size=tiles*4; s=size/2
    base(size, 'grass' if grass else 'paving')
    if not grass:
        paving(-s+.4,-s+.4,size-.8,size-.8,'asphalt')
        for x in [-s+.55,s-.55]:fence(x,-s+2.4,0,size-3,.65,'steel')
        fence(-s+.55,s-.6,size-1.1,0,.65,'steel')
    return s


def hall(x,y,w,d,h,mat='teal',roofmat='slate'):
    box(x-.08,y-.08,.2,w+.16,d+.16,.25,'ivory')
    box(x,y,.45,w,d,h-.25,mat)
    for xx in [x+i*w/max(1,int(w)) for i in range(int(w)+1)]:
        box(xx-.035,y-.065,.45,.07,.1,h-.25,'silver')
        box(xx-.035,y+d-.035,.45,.07,.1,h-.25,'silver')
    box(x-.15,y-.15,h+.2,w+.3,d+.3,.15,roofmat)
    for yy,side in [(y-.02,'front'),(y+d+.02,'back')]:
        for i in range(max(1,int(w/1.1))):
            window(x+(i+.5)*w/max(1,int(w/1.1)),yy,h-.65,.7,.52,side=side,lit=i%3==1)
    for yy in [y+.3+i*.6 for i in range(max(1,int((d-.3)/.6)))]:
        beam((x-.1,yy,h+.37),(x+w+.1,yy,h+.37),.018,roofmat)


def pipe(points,r=.1,mat='silver'):
    for a,b in zip(points,points[1:]):beam(a,b,r,mat)
    for point in points[1:-1]:ball(*point,r*1.03,mat,sub=2)


def ring(x,y,z,r,tube,mat='silver'):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,location=(x,y,z),major_radius=r,minor_radius=tube)
    return finish(bpy.context.object,mat)


def tank(x,y,r,h,mat='white'):
    cyl(x,y,.2,r+.16,.18,'ivory',40)
    cyl(x,y,.38,r,h,mat,48)
    cyl(x,y,h+.38,r,.13,'silver',48,r2=r*.93)
    for z in [.65,h*.5+.38,h+.35]:ring(x,y,z,r+.015,.026,'silver')
    cyl(x,y,h+.51,.2,.13,'steel',20)
    for dx in [-.12,.12]:beam((x+dx,y-r-.1,.4),(x+dx,y-r-.1,h+.7),.018,'steel')
    for i in range(int((h+.2)/.25)):
        z=.55+i*.25;beam((x-.12,y-r-.1,z),(x+.12,y-r-.1,z),.012,'steel')


def transformer(x,y):
    box(x-.7,y-.5,.2,1.4,1,.18,'ivory')
    box(x-.45,y-.33,.38,.9,.66,.7,'steel')
    for xx in [x-.57,x+.48]:
        for i in range(6):box(xx,y-.38+i*.14,.43,.09,.06,.59,'silver')
    for xx in [x-.28,x+.28]:
        cyl(xx,y,1.08,.05,.48,'gold',12)
        for z in [1.18,1.3,1.42]:cyl(xx,y,z,.1,.035,'cream',12)


def control(x,y,w=2.8,d=1.8):
    building(x,y,.2,w,d,1.5,'ivory',floors=1,pitched=False)
    door(x+w*.5,y-.07,.2,.65,1.1,'teal')


def stack(x,y,h=6,r=.3):
    cyl(x,y,.2,r+.15,.3,'ivory',24)
    cyl(x,y,.5,r,h-.3,'silver',32,r2=r*.86)
    for z in [h*.7,h*.85]:cyl(x,y,z,r*(1-.14*z/h)+.018,.32,'red',32)
    ring(x,y,h+.2,r*.88,.035,'steel')
    cyl(x,y,h+.205,r*.73,.006,'dark',32)
