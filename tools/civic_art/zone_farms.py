"""Working farms: planted fields, connected farmyard, barn, silo and farmhouse."""
from common import *


def farm_shell(x,y,z,w,d,h,wall):
    box(x,y,z,w,d,h,wall)
    windows(x,y,z,w,d,h,floors=1)
    box(x-.035,y-.035,z+h-.08,w+.07,d+.07,.08,'ivory')


def farm(level,variant):
    base(12,'grass')
    crop=['gold','leaflight','soil','leafdark'][variant]
    # Four field blocks share a cross-path; equipment can reach the yard.
    for x in [-5.55,-2.3]:
        for y in [-4.65,-1.3]:
            box(x,y,.165,2.85,2.95,.035,'soil',0)
            for row in range(7):
                xx=x+.2+row*.37
                if variant==3:
                    for yy in [y+.4,y+1.3,y+2.2]:
                        cyl(xx,yy,.2,.027,.18,'wood',8)
                        ball(xx,yy,.46,.21,'leafdark',sub=1)
                else:
                    box(xx,y+.12,.21,.2,2.65,.055+level*.008,crop,.02)
                    if variant in [0,1]:
                        for yy in [y+.4,y+1.05,y+1.7,y+2.35]:ball(xx+.1,yy,.3,.09,crop,scale=(1,.6,1),sub=1)
    paving(-5.7,-1.65,6.5,.3,'soil',z=.215)
    paving(-2.7,-4.9,.35,7,'soil',z=.205)
    paving(1.1,-5.85,.8,11.5,'path')
    paving(1.9,-.4,3.6,1.35,'path')
    farm_shell(2.15,1.35,.2,3.0,3.7,1.7,'bricklight')
    roof(2.05,1.25,1.9,3.2,3.9,.85,'slate')
    box(2.75,1.25,.2,1.65,.08,1.45,'wood')
    for xx in [2.78,4.36]:beam((xx,1.2,.25),(xx,1.2,1.6),.025,'ivory')
    beam((2.78,1.2,.3),(4.36,1.2,1.55),.025,'ivory')
    paving(2.65,.85,1.8,.5,'path')
    cyl(4.7,-1.05,.2,.55,2.8+level*.12,'silver',24)
    cyl(4.7,-1.05,3+level*.12,.57,.35,'steel',24,r2=.12)
    for z in [.6,1.1,1.6,2.1,2.6]:cyl(4.7,-1.05,z,.56,.035,'ivory',24)
    farm_shell(2.4,-4.95,.2,2.35,2.15,1.25,'cream' if variant%2==0 else 'ivory')
    roof(2.3,-5.05,1.45,2.55,2.35,.65,'clay')
    door(3.3,-4.95,.2,.65,1.05)
    box(3.85,-5.01,1.0,.13,.045,.19,'lamp')
    paving(3,-5.85,.6,.9,'path')
    if level>=2:
        for x in [-5,-3.7,-4.35]:cyl(x,3.2,.2,.4,.65,'gold',12)
    if level>=3:
        box(-1.2,3.1,.2,1.6,1.8,.9,'glasslight')
        roof(-1.25,3.05,1.1,1.7,1.9,.45,'glass')
    if level==4:
        cyl(4.7,-2.25,.2,.36,.7,'steel',16)
    # Street gates remain open at both the central lane and house approach.
    fence(-5.75,-5.65,6.8,0,.45,'wood')
    fence(1.95,-5.65,.85,0,.45,'wood');fence(3.85,-5.65,1.8,0,.45,'wood')
    fence(-5.75,5.6,11.4,0,.45,'wood')
    tree(-4.7,4.65,size=.45,seed=variant)
