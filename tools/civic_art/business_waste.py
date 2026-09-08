"""Contained hazardous material storage with visible access aisles."""
from common import *


def toxicdump_variant(v=0):
    base(12,'paving')
    for x in [-5.55,5.55]:fence(x,-5.5,0,11,1)
    fence(-5.55,5.5,11.1,0,1)
    fence(-5.55,-5.5,3.9,0,1);fence(1.65,-5.5,3.9,0,1)
    paving(-1.6,-5.9,3.2,10.5,'asphalt')
    for side in [-1,1]:
        x=-5 if side<0 else 2.15
        for row,y in enumerate([-.9,2.4]):
            box(x,y,.2,2.85,2.7,.12,'slate')
            for xx,yy,w,d in [(x,y,2.85,.12),(x,y+2.58,2.85,.12),(x,y,.12,2.7),(x+2.73,y,.12,2.7)]:box(xx,yy,.32,w,d,.25,'ivory')
            for i in range(3):
                for j in range(2):
                    z=.33;h=.85+((i+j+row+v)%3)*.16
                    xx=x+.65+i*.77;yy=y+.8+j*1.08;mat=['yellow','teal','steel'][(i+j+v)%3]
                    cyl(xx,yy,z,.3,h,mat,16)
                    for zz in [.1,h-.1]:cyl(xx,yy,z+zz,.31,.045,'steel',16)
                    cyl(xx,yy,z+h,.28,.035,'slate',16)
    building(-5.05,-4.8,.2,3,2.2,1.5,'steel',floors=1,pitched=False)
    door(-3.55,-4.8,.2,w=.7,h=1.3)
    paving(-3.95,-5.55,.8,.75)
    building(2.1,-4.8,.2,3,2.2,1.7,'ivory',floors=1,roofmat='slate')
    door(3.6,-4.8,.2,w=.7,h=1.4)
    paving(3.2,-5.55,.8,.75)
    # Segregated bunds and a broad aisle make this a storage facility, not random barrels.
    for x in [-1.8,1.8]:
        cyl(x,-5.25,.2,.07,.85,'yellow',12)
        box(x-.28,-5.3,1.05,.56,.08,.48,'yellow')
        text('!',x,-5.39,1.3,.36,'dark')
    lamp(1.85,4.9,2)

for i in range(3):globals()['toxicdump' if i==0 else f'toxicdump_v{i}']=lambda i=i:toxicdump_variant(i)
