"""Speculative late-game generators with distinct, deliberate silhouettes."""
from power_common import *


def microwave():
    yard()
    # Satellite-power receiver: a large shallow concave dish on a braced
    # pedestal, above a low conversion hall and rectenna collection apron.
    hall(-4.3,.5,8.6,5.2,1.85,'blue','silver')
    for x in [-1.1,1.1]:
        beam((x,2.7,2.05),(x*.55,2.7,3.36),.19,'white')
    cx,cy,z=0,2.1,3.4;r=3.7;seg=64;rings=10;verts=[]
    for j in range(rings+1):
        radius=r*j/rings
        for i in range(seg):
            a=i/seg*math.tau
            verts.append((cx+radius*math.cos(a),cy+radius*math.sin(a),z+1.3*(radius/r)**2))
    dish=mesh('concave segmented receiver',verts,[(j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i) for j in range(rings) for i in range(seg)],'white')
    solid=dish.modifiers.new('receiver shell thickness','SOLIDIFY');solid.thickness=.10
    for p in dish.data.polygons:p.use_smooth=True
    ring(cx,cy,z+1.3,r,.065,'silver')
    for i in range(12):
        a=i/12*math.tau
        for j in range(1,10):
            ra=r*j/10;rb=r*(j+1)/10
            beam((cx+ra*math.cos(a),cy+ra*math.sin(a),z+1.3*(ra/r)**2+.014),(cx+rb*math.cos(a),cy+rb*math.sin(a),z+1.3*(rb/r)**2+.014),.015,'silver')
    for i in range(3):
        a=i/3*math.tau
        beam((cx+r*.86*math.cos(a),cy+r*.86*math.sin(a),z+1.0),(cx,cy,z+3.0),.052,'steel')
    cyl(cx,cy,z+2.7,.23,.55,'gold',24,r2=.16)
    # Upright copper dipoles over a fine receiver grid contrast with dark,
    # tilted photovoltaic panels; this is not a recolored solar farm.
    for x in [-4.8,-1.6,1.6,4.8]:
        box(x-1.3,-4.6,.38,2.6,3.15,.12,'steel')
        for xx in [x-1.15+i*.33 for i in range(8)]:box(xx,-4.5,.52,.025,2.95,.015,'gold',0)
        for yy in [-4.4+i*.36 for i in range(8)]:box(x-1.18,yy,.54,2.36,.022,.015,'gold',0)
        for dx in [-.85,0,.85]:
            for yy in [-3.9,-2.7,-1.7]:
                beam((x+dx,yy,.55),(x+dx,yy,.95),.018,'gold')
                beam((x+dx-.16,yy,.95),(x+dx+.16,yy,.95),.016,'silver')
    control(-6.9,1.25,1.9,3.6)
    for y in [.7,3.0,5.3]:transformer(6.3,y)
    lamp(-6.3,-5.8,1.7)


def fusion():
    yard()
    material('fusion glass',(.035,.48,.58),rough=.22,metal=.25,emission=.65)
    # Annular reactor enclosure with radial copper magnet housings. A solid
    # central shield and recessed teal monitor ring imply contained machinery.
    cx,cy=-1.2,1.6
    cyl(cx,cy,.2,4.1,.36,'ivory',64)
    cyl(cx,cy,.56,3.8,2.0,'blue',64)
    ring(cx,cy,2.6,3.45,.18,'white')
    ring(cx,cy,2.95,2.65,.86,'silver')
    ring(cx,cy,3.8,2.65,.075,'fusion glass')
    cyl(cx,cy,.56,1.55,2.2,'steel',48)
    cyl(cx,cy,2.76,1.63,.25,'white',48,r2=1.38)
    # Raised copper coils follow the toroidal vessel's meridian; they are
    # structural ribs with open gaps, not decorative pegs on a white roof.
    for i in range(12):
        a=i/12*math.tau
        for j in range(12):
            t0=-math.pi/2+j*math.tau/12;t1=-math.pi/2+(j+1)*math.tau/12
            ra=2.65+1.0*math.cos(t0);rb=2.65+1.0*math.cos(t1)
            beam((cx+ra*math.cos(a),cy+ra*math.sin(a),2.95+math.sin(t0)),(cx+rb*math.cos(a),cy+rb*math.sin(a),2.95+math.sin(t1)),.12,'gold')
        beam((cx+3.85*math.cos(a),cy+3.85*math.sin(a),.56),(cx+3.65*math.cos(a),cy+3.65*math.sin(a),2.95),.095,'silver')
    # A glazed control gallery faces the circular machine, while a long
    # turbine annex and heat exchangers complete the industrial campus.
    hall(-5.8,-5.7,7.7,2.6,1.9,'white','silver')
    for x in [-5.1,-3.9,-2.7,-1.5,-.3,.9]:
        box(x-.44,-5.77,.7,.88,.045,.88,'fusion glass')
    hall(3.7,-1.9,2.65,7.2,2.25,'teal','silver')
    for y in [-.6,1.3,3.2]:
        pipe([(2.1,y,1.2),(3.35,y,1.2),(3.35,y,1.85),(3.75,y,1.85)],.15,'copper')
    for x in [3.2,5.5]:transformer(x,-4.5)
    door(-2,-5.82,.2,.95,1.3,'teal')
    lamp(-6.5,-3.2,1.7)
