"""Civic monuments with vertical silhouettes and carefully articulated masonry."""
from common import *


def clocktower():
    base(8,'paving')
    box(-1.55,-1.55,.2,3.1,3.1,.25,'ivory')
    box(-1.25,-1.25,.45,2.5,2.5,5.8,'brick')
    for x in [-1.28,1.1]:
        for y in [-1.28,1.1]:box(x,y,.45,.18,.18,5.8,'ivory')
    for z in [2.1,3.6]:
        for side,x,y in [('front',0,-1.25),('back',0,1.25),('left',-1.25,0),('right',1.25,0)]:window(x,y,z,w=.45,h=.85,side=side,lit=True)
    box(-1.48,-1.48,5.05,2.96,2.96,.2,'ivory')
    for face,x,y in [('front',0,-1.28),('back',0,1.28),('left',-1.28,0),('right',1.28,0)]:clock(x,y,5.77,.56,face)
    box(-1.5,-1.5,6.25,3,3,.2,'cream')
    box(-1.05,-1.05,6.45,2.1,2.1,1.15,'ivory')
    for side,x,y in [('front',0,-1.05),('back',0,1.05),('left',-1.05,0),('right',1.05,0)]:
        window(x,y,6.65,w=.85,h=.65,side=side)
    hip(-1.4,-1.4,7.6,2.8,2.8,1.8,'copper')
    cyl(0,0,9.4,.04,.65,'gold',12);ball(0,0,10.08,.1,'gold')
    door(0,-1.25,.45,w=.8,h=1.5,mat='wood')
    stair(-.6,-1.95,1.2,n=3)
    paving(-.8,-3.95,1.6,2,'path')
    for x,y in [(-2.8,-2.6),(2.8,-2.6),(-2.8,2.6),(2.8,2.6)]:
        planter(x-.35,y-.35,.7,.7);tree(x,y,.4,size=.48,seed=2)


def cathedral():
    base(12,'paving')
    # Long nave, lower aisles and a projecting transept give a cross-shaped plan.
    building(-2.3,-2.2,.2,4.6,7,4.1,'ivory',floors=2,roofmat='slate')
    for x in [-3.6,2.3]:
        box(x,-1.8,.2,1.3,6.1,2.35,'ivory')
        roof(x-.08,-1.88,2.55,1.46,6.26,.55,'slate')
    building(-4.75,1,.2,9.5,2.4,2.8,'ivory',floors=1,roofmat='slate')
    for x in [-3.6,2.3]:
        for y in [-1.25,.1,3.8]:
            box(x-.08,y,.2,.22,.38,2.8,'cream')
    # Two slender spires frame the rose window and the main entrance.
    for x in [-3.45,2.05]:
        box(x,-3.9,.2,1.4,1.7,5.6,'ivory')
        for xx in [x-.05,x+1.25]:box(xx,-3.95,.2,.2,.22,5.6,'cream')
        window(x+.7,-3.9,4.25,w=.62,h=.85,arch=True)
        for z in [1.8,3.6]:box(x-.1,-4,z,1.6,.2,.11,'cream')
        for side,xx in [('left',x),('right',x+1.4)]:window(xx,-3.05,4.25,w=.5,h=.8,side=side)
        hip(x-.22,-4.12,5.8,1.84,2.14,2.7,'slate')
        cyl(x+.7,-3.05,8.5,.035,.6,'gold',10)
    box(-2.05,-3.65,.2,4.1,1.45,3.65,'ivory')
    mesh('western pediment',[(-2.05,-3.67,3.85),(2.05,-3.67,3.85),(0,-3.67,5.05)],[(0,1,2)],'ivory')
    # Radial glass petals sit behind stone tracery, rather than a flat painted circle.
    for i in range(12):
        a=i*math.tau/12;b=(i+1)*math.tau/12
        mesh('rose glass',[(0,-3.7,3.22),(.63*math.cos(a),-3.7,3.22+.63*math.sin(a)),(.63*math.cos(b),-3.7,3.22+.63*math.sin(b))],[(0,1,2)],['blue','purple','gold'][i%3])
        beam((0,-3.74,3.22),(.66*math.cos(a),-3.74,3.22+.66*math.sin(a)),.026,'cream')
        beam((.68*math.cos(a),-3.74,3.22+.68*math.sin(a)),(.68*math.cos(b),-3.74,3.22+.68*math.sin(b)),.055,'cream')
    door(0,-3.65,.2,w=1.35,h=1.9,mat='wood')
    paving(-1.4,-5.9,2.8,2,'path')
    for x in [-4.7,3.7]:planter(x,-5.1,1,.65,flowers=True)
    # Rear sacristy has its own door and a short paved approach.
    door(0,4.8,.2,w=.9,h=1.6,face='back')
    paving(-.65,4.8,1.3,1)
    for x in [-1.8,1.8]:lamp(x,-4.9,1.7)
