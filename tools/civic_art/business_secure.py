"""Secure campuses: controlled gates and connected internal circulation."""
from common import *


def prison():
    base(16,'paving')
    # Continuous perimeter, with a genuine pedestrian/vehicle gate at the front.
    for x,y,w,d in [(-7.5,-7.4,5.8,.22),(1.7,-7.4,5.8,.22),(-7.5,7.2,15,.22),(-7.5,-7.18,.22,14.38),(7.28,-7.18,.22,14.38)]:
        box(x,y,.18,w,d,1.6,'ivory')
    for x in [-7,7]:
        for y in [-6.9,6.9]:
            box(x-.48,y-.48,.2,.96,.96,2.5,'ivory')
            box(x-.67,y-.67,2.7,1.34,1.34,.92,'slate')
            for side,xx,yy in [('front',x,y-.68),('back',x,y+.68)]:window(xx,yy,2.83,w=.8,h=.48,side=side,lit=True)
            hip(x-.75,y-.75,3.62,1.5,1.5,.32,'steel')
    paving(-1.65,-7.9,3.3,6.2,'asphalt')
    for x in [-3.3,1.5]:building(x,-5.2,.2,1.8,2,2.1,'bricklight',floors=1,pitched=False)
    # Gate passage runs below the bridge between two screening offices.
    box(-1.5,-5.2,1.95,3,2,.35,'bricklight')
    box(-1.6,-5.4,2.3,3.2,2.4,.22,'steel')
    for x in [-5.9,2.7]:
        building(x,-1.8,.2,3.2,7.1,3.05,'ivory',floors=2,pitched=False)
        door(x+1.6,-1.8,.2,w=.85,h=1.55,mat='steel')
        # The common cross aisle reaches both cell-block doors.
        for y in [-.7,.9,2.5,4.1]:
            for z in [1,2.3]:
                for dx in [-.12,.12]:beam((x+dx,-1.87,z),(x+dx,-1.87,z+.48),.018,'steel')
    paving(-5.1,-3,3.45,1.2,'asphalt');paving(1.65,-3,3.45,1.2,'asphalt')
    paving(-2.1,-1.7,4.2,7,'path')
    # Exercise court stays between the cell wings, with no route crossing furniture.
    box(-1.5,.5,.19,3,3.2,.025,'teal')
    for x in [-1.48,1.46]:box(x,.5,.22,.025,3.2,.01,'white')
    for y in [.5,3.68]:box(-1.48,y,.22,2.96,.025,.01,'white')
    fence(-2.1,.15,1.55,0,1.2);fence(.55,.15,1.55,0,1.2)
    for x in [-2.25,2.25]:lamp(x,-2.4,2.5)


def armybase():
    base(20)
    material('olive',(.31,.36,.22),texture='stone')
    paving(-1.1,-9.8,2.2,17.2,'asphalt')
    for x in [-8.7,1.1]:paving(x,-1.8,7.6,1.5,'asphalt')
    for x in [-8.7,1.1]:paving(x,6.2,7.6,1.2,'asphalt')
    for x in [-8.1,-4.4,2.1,5.8]:
        building(x,1,.2,2.3,4.7,1.75,'olive',floors=1,roofmat='slate')
        door(x+1.15,1,.2,w=.65,h=1.4,mat='wood')
        paving(x+.7,-.3,.9,1.3)
    building(-8.1,-6.9,.2,5.6,3.7,2.6,'ivory',floors=2,roofmat='slate')
    door(-5.3,-6.9,.2,w=1,h=1.7)
    paving(-5.85,-8,1.1,1.1)
    paving(-4.75,-8,3.65,.85)
    # Open parade square and flag, alongside a separate equipment workshop.
    paving(2,-7.6,6.6,4.5,'paving')
    for x in [2.5,4.2,5.9,7.6]:
        for y in [-6.8,-5.5,-4.2]:box(x,y,.19,.65,.04,.015,'white')
    cyl(1.55,-7.9,.2,.045,4.8,'silver',12)
    mesh('base flag',[(1.55,-7.9,4.95),(2.55,-7.85,4.85),(2.55,-7.85,4.25),(1.55,-7.9,4.35)],[(0,1,2,3)],'teal')
    building(-7.8,7.8,.2,6.2,1.55,1.3,'olive',floors=1,pitched=False)
    for x in [-6.6,-4.7,-2.8]:box(x-.55,7.77,.2,1.1,.04,1.1,'steel')
    for x,w in [(-9.4,8.1),(1.3,8.1)]:fence(x,-9.3,w,0,.8)
    for x in [-9.4,9.4]:fence(x,-9.3,0,18.6,.8)
    fence(-9.4,9.3,18.8,0,.8)
    building(1.65,-9,.2,1.5,1.1,1.3,'olive',floors=1,pitched=False)
    for x in [-1.4,1.4]:lamp(x,-8.9,2.3)
    for x,y in [(-8.9,-8.4),(8.9,8.3)]:tree(x,y,size=.55,seed=4)
