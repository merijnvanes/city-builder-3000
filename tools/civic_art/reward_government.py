"""Domestic and ceremonial rewards, each with its own massing and public approach."""
from common import *


def mayorhouse():
    base(8)
    building(-2.4,-1.6,.2,4.8,3.6,3.6,'cream',floors=2,roofmat='clay')
    box(1.3,.4,3.8,.48,.65,1.25,'brick')
    box(1.24,.34,5.05,.6,.77,.13,'ivory')
    box(-2.75,-2.75,.2,5.5,1.2,.15,'paving')
    for x in [-2.4,-1.2,1.2,2.4]:
        box(x-.09,-2.65,.35,.18,.18,1.94,'ivory')
        box(x-.14,-2.7,2.23,.28,.28,.13,'cream')
    hip(-2.75,-2.8,2.36,5.5,1.35,.4,'slate')
    door(0,-1.6,.35,w=1,h=1.7,mat='wood')
    stair(-.8,-3.03,1.6,n=2)
    paving(-.75,-3.8,1.5,.78)
    paving(-3.45,-2.6,.7,5.6,'path')
    for x in [-3.2,3.2]:tree(x,2.55,size=.65,seed=int(x*10))
    for x in [-2.2,1.35]:planter(x,-3.6,.85,.5,flowers=True)
    for x in [-3.65,1.05]:fence(x,-3.7,2.6,0,.55)
    fence(-3.65,3.6,7.3,0,.55)
    lamp(3.2,-2.9,1.5)


def cityhall():
    base(12,'paving')
    building(-4.5,-1.5,.2,9,5.1,3.5,'ivory',floors=2,pitched=False)
    # A square clock tower and copper lantern, distinct from a collegiate quad.
    box(-1.3,.0,3.7,2.6,2.6,.22,'cream')
    box(-1.15,.15,3.92,2.3,2.3,3.25,'ivory')
    for x in [-1.16,.99]:
        for y in [.14,2.3]:box(x,y,3.94,.17,.17,3.2,'cream')
    for x in [-.52,.52]:window(x,.15,4.25,w=.44,h=.9,lit=True)
    for face,x,y in [('front',0,.12),('back',0,2.48),('left',-1.18,1.3),('right',1.18,1.3)]:clock(x,y,6.05,.48,face)
    box(-1.32,-.02,7.15,2.64,2.64,.2,'cream')
    box(-.88,.42,7.35,1.76,1.76,.95,'teal')
    for x in [-.45,.45]:
        window(x,.42,7.48,w=.45,h=.58,lit=True)
        window(x,2.18,7.48,w=.45,h=.58,side='back',lit=True)
    hip(-1.08,.22,8.3,2.16,2.16,.92,'copper')
    cyl(0,1.3,9.22,.045,.75,'gold',10)
    mesh('city banner',[(0,1.3,9.94),(.63,1.3,9.82),(.63,1.3,9.45),(0,1.3,9.57)],[(0,1,2,3)],'teal')
    door(0,-1.5,.2,w=1.4,h=1.8)
    for x in [-1.15,1.15]:cyl(x,-2.3,.2,.13,1.91,'ivory')
    box(-1.55,-2.65,2.11,3.1,1.3,.12,'cream')
    text('CITY HALL',0,-1.64,3.42,.31,'teal')
    paving(-1.6,-5.7,3.2,3.1,'path')
    for x in [-4.9,3.5]:
        planter(x,-4.9,1.4,1,flowers=True)
        planter(x,4.5,1.4,.65)
    for x in [-3.2,3.2]:lamp(x,-3.55,2.1)


def courthouse():
    base(12,'paving')
    building(-4.5,-.5,.6,9,5.1,3.4,'ivory',floors=2,pitched=False)
    # A broad stair and six-column portico carry a stone pediment.
    box(-4.4,-2.25,.16,8.8,1.75,.44,'ivory')
    for i in range(6):box(-4,-3.93+i*.28,.16,8,.28,(i+1)*.07,'ivory')
    for x in [-3.65,-2.2,-.75,.75,2.2,3.65]:
        cyl(x,-1.78,.6,.25,.14,'cream',20)
        cyl(x,-1.78,.74,.16,2.44,'ivory',20,r2=.135)
        cyl(x,-1.78,3.18,.25,.18,'cream',20)
    box(-4.4,-2.2,3.36,8.8,1.72,.45,'cream')
    roof(-4.45,-2.25,3.81,8.9,1.8,1.08,'slate')
    mesh('carved stone pediment',[(-4.45,-2.31,3.81),(4.45,-2.31,3.81),(0,-2.31,4.89)],[(0,1,2)],'ivory')
    text('JUSTICE',0,-2.235,3.58,.28,'teal')
    # Central doors sit between window bays and open onto the portico landing.
    door(0,-.5,.6,w=1.4,h=1.8,mat='wood')
    paving(-1.6,-5.8,3.2,1.85,'path')
    for x,angle in [(-4.85,math.pi/2),(4.85,-math.pi/2)]:
        paving(x-.55,-3.8,1.1,1.4,'path')
        bench(x,-3.1,angle)
    for x in [-5.15,4.55]:planter(x,1.1,.6,3.1)
    for x in [-3,3]:lamp(x,-4.9,1.8)


def statue():
    base(4,'paving')
    box(-.8,-.8,.2,1.6,1.6,.16,'ivory')
    box(-.63,-.63,.36,1.26,1.26,.16,'cream')
    box(-.43,-.43,.52,.86,.86,.9,'ivory')
    box(-.55,-.55,1.42,1.1,1.1,.15,'cream')
    box(-.28,-.453,.8,.56,.025,.34,'gold')
    text('OUR CITY',0,-.48,.96,.105,'slate')
    bronze=material('civicbronze',(.19,.32,.25),rough=.5,metal=.65)
    # A coat, trousers, head, and a raised arm give the sculpture a human silhouette.
    for x in [-.16,.16]:
        box(x-.09,-.18,1.57,.19,.34,.09,bronze)
        beam((x,0,1.66),(x,0,2.3),.105,bronze)
    mesh('bronze coat',[(-.31,-.2,2.08),(.31,-.2,2.08),(.31,.19,2.08),(-.31,.19,2.08),(-.26,-.14,2.78),(.26,-.14,2.78),(.26,.15,2.78),(-.26,.15,2.78)],[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(0,3,2,1)],bronze)
    cyl(0,0,2.78,.095,.12,bronze,12)
    ball(0,-.015,3.07,.21,bronze,scale=(.82,.87,1.16),sub=2)
    ball(0,-.195,3.07,.055,bronze,scale=(.6,1,1))
    beam((-.27,0,2.66),(-.4,-.04,2.27),.095,bronze)
    beam((-.4,-.04,2.27),(-.36,-.19,2.1),.075,bronze)
    beam((.26,0,2.65),(.55,-.04,2.87),.09,bronze)
    beam((.55,-.04,2.87),(.62,-.05,3.17),.07,bronze)
    ball(.62,-.05,3.2,.09,bronze,scale=(.8,.6,1.3))
    # Low uplights leave the approach and the silhouette uncluttered.
    for x,y in [(-1.35,-1.2),(1.35,.95)]:
        cyl(x,y,.2,.14,.16,'slate',12)
        ball(x,y,.37,.09,'lamp',scale=(1,1,.5))
