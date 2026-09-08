"""Masonry flats, brownstones and balcony apartments with useful shared gardens."""
from common import *


def balconies(x,y,w,levels,step=.85):
    for floor in range(1,levels):
        z=.2+floor*step
        box(x,y-.3,z,w,.3,.06,'ivory')
        beam((x,y-.3,z+.34),(x+w,y-.3,z+.34),.015,'steel')
        for xx in [x,x+w/2,x+w]:beam((xx,y-.3,z+.06),(xx,y-.3,z+.34),.013,'steel')


def apartments(size,level,variant):
    s=size*4;half=s/2;floors=2+level;h=floors*.85
    base(s)
    wall=['cream','brick','ivory'][variant]
    if size==1:
        x=-1.45;y=-.85;w=2.9;d=2.35
        building(x,y,.2,w,d,h,wall,floors=floors,pitched=False)
        door(0,y,.2,w=.65,h=1.1,mat='wood')
        paving(-.5,-1.95,1,1.1,'path')
        if variant==1:
            box(x-.07,y-.07,h+.2,w+.14,d+.14,.15,'cream')
            for xx in [-1.1,1.1]:box(xx,y-.08,.2,.09,.13,h,'bricklight')
        elif variant==2:balconies(-1.25,y,2.5,floors)
        else:box(.5,.65,h+.35,.55,.5,.25,'steel')
        planter(-1.8,-1.75,.6,.55)
        tree(1.5,-1.45,size=.23,seed=2)
    elif variant==2:
        building(-3.45,.05,.2,6.9,3.15,h+.85,'ivory',floors=floors+1,pitched=False)
        balconies(-3.15,.05,6.3,floors+1)
        door(0,.05,.2,w=.9,h=1.3)
        paving(-.6,-3.95,1.2,4,'path')
        for x in [-2.4,2.4]:
            planter(x-.6,-2.8,1.2,.9,flowers=True)
            tree(x,-1.15,size=.48,seed=level)
        for x,angle in [(-1.4,math.pi/2),(1.4,-math.pi/2)]:
            paving(x-.55,-3.4,1.1,.9);bench(x,-2.95,angle)
    else:
        # Connected U-shaped wings enclose a courtyard with an open street mouth.
        building(-3.4,1,.2,6.8,2.3,h,wall,floors=floors,pitched=False)
        for x in [-3.4,1.8]:
            building(x,-2.6,.2,1.6,3.6,max(1.4,h-.4),'bricklight' if variant==0 else 'brick',floors=floors,pitched=False)
            door(x+.8,-2.6,.2,w=.65,h=1.1,mat='wood')
            paving(x+.35,-3.95,.9,1.35)
        door(0,1,.2,w=.9,h=1.3)
        paving(-.5,-3.95,1,4.95,'path')
        for x in [-1.2,1.2]:
            planter(x-.3,-1.7,.6,.8)
            tree(x,-.25,size=.32,seed=variant)
        if variant==1:
            for x in [-3.4,1.8]:box(x-.04,-2.64,h-.15,1.68,3.64,.17,'cream')
