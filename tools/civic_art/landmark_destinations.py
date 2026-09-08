"""Public destinations: performance, astronomy and aquatic exhibits."""
from common import *


def operahouse():
    base(12,'paving')
    building(-4.7,-1.9,.35,9.4,5.7,2.6,'ivory',floors=2,pitched=False)
    # A rounded copper auditorium roof and a distinct backstage fly tower.
    cyl(0,.7,2.95,2.7,.65,'cream',32)
    dome(0,.7,3.6,2.8,1.65,'copper')
    building(-2.45,3,.35,4.9,2.2,4.25,'bricklight',floors=2,pitched=False)
    for x in [-3.9,-2.6,-1.3,0,1.3,2.6,3.9]:
        cyl(x,-2.85,.35,.13,2.2,'ivory',16)
    box(-4.45,-3.05,2.55,8.9,1.25,.28,'cream')
    for x in [-2.6,0,2.6]:door(x,-1.9,.35,w=1,h=1.7,mat='wood')
    for i in range(3):box(-4.4,-3.72+i*.22,.16,8.8,.22,(i+1)*.065,'ivory')
    text('OPERA',0,-3.09,2.7,.35,'gold')
    paving(-1.55,-5.9,3.1,2.17,'path')
    for x in [-4.9,3.7]:planter(x,-5,1.2,.8,flowers=True)
    for x in [-3,3]:lamp(x,-4.3,2.1)
    # A roof sculpture has the shape of a lyre, clear of the auditorium shell.
    for x in [-.3,.3]:beam((x,.7,5.18),(x*1.4,.7,5.95),.05,'gold')
    beam((-.42,.7,5.95),(.42,.7,5.95),.05,'gold')
    for x in [-.15,0,.15]:beam((x,.7,5.3),(x,.7,5.95),.013,'gold')
    door(0,5.2,.35,w=1.5,h=2,face='back');paving(-1,5.2,2,.65)


def observatory():
    base(8)
    building(-2.9,-1.2,.2,5.8,3.6,1.8,'ivory',floors=1,pitched=False)
    cyl(.35,.6,2,1.72,.7,'ivory',32)
    # An open meridian slot exposes the tilted telescope through the shell.
    r=1.83;z=2.7;h=1.65;seg=48;rings=12;verts=[];faces=[]
    for j in range(rings+1):
        a=j/rings*math.pi/2
        for i in range(seg):
            theta=i/seg*math.tau
            verts.append((.35+r*math.cos(a)*math.cos(theta),.6+r*math.cos(a)*math.sin(theta),z+h*math.sin(a)))
    for j in range(rings):
        for i in range(seg):
            if 33<=i<=38:continue
            faces.append((j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i))
    mesh('slit observatory shell',verts,faces,'silver')
    cyl(.35,.6,2.7,.15,.62,'steel',16)
    beam((.35,.7,3),(.35,-1.15,4.48),.23,'slate')
    beam((.35,-.98,4.34),(.35,-1.2,4.52),.26,'silver')
    door(-1.5,-1.2,.2,w=.85,h=1.5)
    paving(-2,-3.9,1,2.7,'path')
    paving(-3.55,-2,1.55,.8,'path')
    bench(-2.85,-1.6,math.pi/2)
    tree(2.9,2.9,size=.55,seed=3)
    planter(1.6,-3.5,1.6,.7)
    # Low shielded amber lights keep the astronomy campus visually quiet.
    for x in [-2.2,-.8]:
        cyl(x,-3.4,.2,.07,.45,'slate',12);ball(x,-3.4,.64,.075,'lamp')


def aquarium():
    base(12,'paving')
    building(-4.7,-.9,.2,9.4,5.3,2.3,'teal',floors=1,pitched=False)
    # Two overlapping wave shells above a glazed entry hall.
    for y,z,w in [(-1.15,2.5,9.7),(1.45,2.8,9.1)]:
        verts=[]
        for j in range(17):
            x=-w/2+j*w/16;rise=.7+1.2*math.sin(j/16*math.pi)
            verts.extend([(x,y,z+rise),(x,y+2.5,z+rise)])
        mesh('wave roof',verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(16)],'copper')
        for edge in [0,1]:
            yy=y+edge*2.5
            profile=[(-w/2,yy,2.5),(w/2,yy,2.5)]+[verts[j*2+edge] for j in range(16,-1,-1)]
            mesh('wave clerestory',profile,[tuple(range(len(profile)))],'glass')
        for xx in [-w/2,w/2]:
            for yy in [y,y+2.5]:beam((xx,yy,2.5),(xx,yy,z+.7),.045,'silver')
        for j in range(0,17,2):
            x=-w/2+j*w/16;rise=.7+1.2*math.sin(j/16*math.pi)
            beam((x,y,z+rise),(x,y+2.5,z+rise),.025,'silver')
    for x in [-3.5,-1.75,1.75,3.5]:
        box(x-.65,-1,.35,1.3,.06,1.8,'glasslight')
    door(0,-.9,.2,w=1.3,h=1.8)
    box(-1.4,-1.5,2.25,2.8,.7,.16,'silver')
    text('AQUARIUM',0,-1.54,2.34,.26,'teal')
    paving(-1,-5.9,2,4.4,'path')
    # Shallow tidal exhibits are separated from the central entrance walk.
    for x in [-4.9,1.8]:
        box(x,-4.85,.18,3.1,2.8,.25,'ivory')
        box(x+.18,-4.67,.43,2.74,2.44,.018,'water')
        for dx,dy in [(.6,.6),(2.3,1.85)]:ball(x+dx,-4.85+dy,.5,.24,'steel',scale=(1.2,.8,.4))
    for x in [-1.35,1.35]:lamp(x,-4.7,1.6)
    door(0,4.4,.2,w=1,h=1.6,face='back');paving(-.7,4.4,1.4,1.4)
