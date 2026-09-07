"""Fixed-lot airport and working cargo port; port-zone coverage is a separate contract."""
from common import *


def airport():
    # Explicit 24 by 20 model-unit grounds correspond to the 6 by 5 game lot.
    box(-11.9,-9.9,-.12,23.8,19.8,.24,'ivory')
    box(-11.78,-9.78,.08,23.56,19.56,.08,'grass')
    paving(-11,4.6,22,3.1,'asphalt')
    for x in range(-9,10,2): box(x,6.1,.22,1,.09,.02,'white')
    for x in [-10.2,9.4]:
        for y in [4.95,5.3,5.65,6.55,6.9,7.25]:box(x,y,.22,.8,.16,.02,'white')
    for x in range(-10,11,2):
        for y in [4.48,7.82]:cyl(x,y,.16,.07,.055,'lamp',8)
    paving(-10,-1.7,20,4.8,'asphalt')
    paving(-6,3.1,2,1.5,'asphalt');paving(6,3.1,2,1.5,'asphalt')
    for x in [-5,7]:box(x-.035,1,.22,.07,3.6,.02,'gold')
    # Low glazed terminal with a cantilevered concourse and a landside forecourt.
    building(-9,-6.8,.2,11.2,3.8,2.25,'ivory',floors=1,pitched=False)
    for x in [-7.9,-5.7,-3.5,-1.3]:
        box(x,-3.04,.55,1.45,.05,1.5,'glasslight')
        box(x+.69,-3.1,.53,.055,.08,1.54,'cream')
    box(-9.4,-3.35,2.5,12,1,.15,'cream')
    for x in [-8.8,1.7]:beam((x,-2.7,.2),(x,-2.7,2.5),.045,'silver')
    for x in [-6.8,-2.4]:
        box(x,-2.6,.25,1.4,1.15,.18,'paving')
        box(x,-1.47,.25,1.4,.075,.035,'gold')
    door(-3.4,-6.8,.2,w=1.5,h=1.7)
    paving(-9,-9.4,11.2,2.6)
    paving(-9,-3,11.2,1.3)
    paving(4.8,-9.4,1,2.6)
    text('TERMINAL',-3.4,-6.91,2.11,.32,'teal')
    # Control cab with wraparound glazing sits on a tapered concrete shaft.
    cyl(5.3,-6.1,.2,.68,4.9,'ivory',8,r2=.53)
    cyl(5.3,-6.1,5.1,1.12,.18,'cream',8)
    cyl(5.3,-6.1,5.28,1.0,.87,'glasslight',8)
    for i in range(8):
        a=i*math.tau/8;beam((5.3+math.cos(a),-6.1+math.sin(a),5.28),(5.3+math.cos(a),-6.1+math.sin(a),6.15),.03,'ivory')
    cyl(5.3,-6.1,6.15,1.15,.16,'cream',8)
    cyl(5.3,-6.1,6.31,.035,.95,'steel',8)
    ball(5.3,-6.1,7.27,.07,'lamp')
    # Hangar doors face the apron; its clear opening has a structural frame.
    box(7.9,-6.8,.2,3.0,3.5,2.15,'steel')
    roof(7.74,-6.96,2.35,3.32,3.82,.65,'slate')
    box(8.15,-3.28,.25,2.5,.04,1.8,'dark')
    for x in [8.18,10.28]:box(x,-3.31,.25,.35,.05,1.77,'silver')
    paving(7.9,-3.3,3,1.6,'asphalt')
    # Windsock, with no crude parked aircraft cluttering the movement area.
    beam((9.7,8.6,.2),(9.7,8.6,2.2),.035,'steel')
    for i in range(4):
        beam((9.7+i*.24,8.6,2.12-i*.09),(9.7+(i+1)*.24,8.6,2.03-i*.09),.14-i*.024,'red' if i%2==0 else 'white')


COLORS=['teal','blue','gold','red','ivory']

def container(x,y,z,color):
    box(x,y,z,2.25,1.02,.96,color)
    for i in range(10):box(x+.13+i*.21,y-.025,z+.08,.035,.03,.8,color,.005)
    for yy in [y+.1,y+.87]:beam((x,yy,z+.98),(x+2.25,yy,z+.98),.025,'steel')
    for xx in [x+.08,x+2.12]:box(xx,y-.04,z+.05,.055,.04,.86,'silver')


def cargo_port(palette):
    base(16,'paving')
    paving(-7.5,-7.45,15,2,'asphalt')
    paving(-7.5,5.7,15,1.5,'asphalt')
    # Warehouse and stacked cargo occupy separate service strips.
    building(-7,1.5,.2,5.2,3.8,2.9,'brick',floors=1)
    for x in [-6.5,-4.9,-3.3]:
        box(x,1.37,.24,1.1,.09,1.9,'teal')
        for z in [.5,.85,1.2,1.55,1.9]:box(x,1.32,z,1.1,.03,.025,'steel')
    for row in range(2):
        for col in range(3):
            x=-7+col*2.5;y=-4.3+row*1.55
            container(x,y,.2,COLORS[(col+row+palette)%5])
            if (col+row)%2==0:container(x,y,1.19,COLORS[(col+row+2)%5])
    # Rail-mounted gantry: portal legs, bracing, hoist and suspended spreader.
    for x in [2.5,6.3]:
        box(x-.1,-4.9,.2,.2,9.9,.09,'steel')
        for y in [-2.5,1.9]:
            box(x-.24,y-.35,.3,.48,.7,.28,'slate')
            beam((x,y,.58),(x,y,5.7),.12,'gold')
        beam((x,-2.5,1.1),(x,1.9,5.5),.055,'gold')
        beam((x,1.9,1.1),(x,-2.5,5.5),.055,'gold')
    for y in [-2.5,1.9]:
        box(2.1,y-.16,5.7,4.6,.32,.36,'gold')
        for i in range(4):beam((2.2+i,y,6.04),(2.7+i,y,6.45),.035,'cream')
        beam((2.2,y,6.45),(6.4,y,6.45),.045,'gold')
    box(4.2,-2.65,6.1,.6,4.7,.25,'teal')
    for x in [4.25,4.75]:beam((x,-.4,6.12),(x,-.4,2.1),.02,'slate')
    box(3.3,-.95,2.0,2.4,1.1,.16,'gold')
    box(5.8,-2.9,4.65,.85,.8,.8,'teal');box(5.86,-2.93,4.95,.72,.03,.4,'glasslight')
    for x in [-6,-3,0,3,6]:
        cyl(x,7.38,.2,.14,.33,'slate',12)
        beam((x-.23,7.38,.48),(x+.23,7.38,.48),.07,'slate')
        box(x-.45,5.55,.21,.9,.1,.025,'gold')
    lamp(-7.3,-5.1,2.7);lamp(7.2,4.8,2.7)


def seaport():cargo_port(0)
def seaport_v1():cargo_port(1)
def seaport_v2():cargo_port(2)
def seaport_v3():cargo_port(3)
def seaport_v4():cargo_port(4)
