"""A domed university and a modern medical research campus, separate from civic services."""
from common import *


def university():
    base(16)
    paving(-1.1,-7.75,2.2,5.95,'path')
    paving(-6.5,-1.8,13,1,'path')
    box(-2,-.25,.2,4,.95,.25,'ivory')
    for i in range(2):box(-1.1,-.8+i*.275,.2,2.2,.275,(i+1)*.12,'ivory')
    # Central rotunda with an academic lantern and a columned entrance.
    cyl(0,3,.2,2.65,.25,'ivory',32)
    cyl(0,3,.45,2.48,3.6,'ivory',32)
    cyl(0,3,4.05,2.68,.24,'cream',32)
    dome(0,3,4.29,2.58,1.75,'copper')
    cyl(0,3,6.04,.42,.5,'ivory',16)
    dome(0,3,6.54,.5,.4,'copper')
    for i in range(12):
        a=i*math.tau/12
        # Tall recessed panels follow the drum's radial structure.
        x,y=2.5*math.sin(a),3-2.5*math.cos(a)
        before=set(bpy.context.scene.objects)
        window(0,-2.51,1.15,w=.7,h=1.65,lit=i%3==0)
        for obj in set(bpy.context.scene.objects)-before:
            xx,yy=obj.location.x,obj.location.y;c,s=math.cos(a),math.sin(a)
            obj.location.x=xx*c-yy*s;obj.location.y=3+xx*s+yy*c;obj.rotation_euler.z+=a
    # Flanking faculty wings frame the green, without reproducing the college quad.
    for x in [-6.7,3.6]:building(x,-.8,.2,3.1,6.7,2.8,'bricklight',floors=2,roofmat='slate')
    for x in [-5.15,5.15]:door(x,-.8,.2,w=.85,h=1.65)
    for x in [-1.7,-.6,.6,1.7]:cyl(x,.06,.45,.14,1.95,'cream',16)
    box(-2,-.22,2.4,4,.9,.2,'cream')
    roof(-2.05,-.27,2.6,4.1,1,.55,'slate')
    door(0,.49,.45,w=1.3,h=1.85,mat='wood')
    # Lecture theatre at the front of the green: a fan-shaped, stepped volume.
    cyl(-4.6,-4.6,.2,1.7,1.25,'brick',24)
    cyl(-4.6,-4.6,1.45,1.82,.15,'cream',24)
    dome(-4.6,-4.6,1.6,1.72,.55,'slate')
    door(-4.6,-6.28,.2,w=.85,h=1.05)
    paving(-5.05,-7.6,.9,1.32,'path')
    # Reading garden: seats face a recessed walk and stay off the main axis.
    paving(2.4,-5.3,3.2,1.4,'path')
    bench(3,-3.85);bench(5,-3.85)
    paving(2.3,-3.9,3.4,.8)
    paving(1.1,-4.9,1.3,.8,'path')
    for x,y in [(6.5,-5.9),(2.2,-6.5),(-6.9,6.8),(6.9,6.8)]:tree(x,y,size=.65,seed=int(x*7+y))
    for x in [-1.5,1.5]:lamp(x,-6.7,2)
    text('UNIVERSITY',0,-.25,2.5,.22,'teal')


def lab_block(x,y,w,d,h):
    box(x,y,.2,w,d,h,'ivory')
    box(x-.08,y-.08,.2,w+.16,d+.16,.18,'cream')
    for z in [1.0,2.45,3.9,5.35]:
        if z+.8>h:continue
        for yy in [y-.03,y+d+.01]:
            box(x+.18,yy,z,w-.36,.035,.84,'glasslight')
            for i in range(1,int(w/.7)):
                box(x+i*w/int(w/.7),yy-.025,z,.05,.075,.84,'ivory')
        for xx in [x-.03,x+w+.01]:
            box(xx,y+.18,z,.035,d-.36,.84,'glasslight')
            for i in range(1,int(d/.7)):box(xx-.025,y+i*d/int(d/.7),z,.075,.05,.84,'ivory')
    door(x+w/2,y,.2,w=1.2,h=1.8)
    box(x+w/2-.85,y-.85,2.05,1.7,.9,.1,'cream')
    # Occupancy strips are restrained; roof plant and lab glazing establish use.
    box(x+.25,y-.06,1.15,w*.2,.035,.45,'windowlit')
    box(x-.12,y-.12,h+.2,w+.24,d+.24,.16,'cream')
    box(x+.15,y+.15,h+.36,w-.3,d-.3,.08,'slate')
    for yy in [y+.55,y+d-1.15]:
        box(x+.5,yy,h+.44,w-1,.6,.45,'steel')
        for xx in [x+.85,x+w-.85]:cyl(xx,yy+.3,h+.9,.21,.06,'slate',16)
    for xx in [x+.45,x+w-.45]:cyl(xx,y+d-.4,h+.44,.09,.95,'silver',12)


def medcenter():
    base(16,'paving')
    # Two laboratory bars, an elevated glazed link, and a low public science hall.
    lab_block(-6.7,-.5,4.2,6.7,6.5)
    lab_block(1.7,1.1,4.9,5.1,4.9)
    box(-2.5,2.2,2.6,4.2,1.1,1.25,'glasslight')
    for x in [-2.5,-1.1,.3,1.6]:box(x,2.17,2.6,.07,1.16,1.25,'ivory')
    box(-2.55,2.15,3.85,4.3,1.2,.13,'cream')
    building(-4.5,-5.1,.2,9,3.1,2.15,'ivory',floors=1,pitched=False)
    # A sawtooth roof over the public research hall gives the campus a process identity.
    for x in [-3.9,-1.3,1.3]:
        mesh('northlight monitor',[(x,-4.65,2.72),(x+1.8,-4.65,2.72),(x+1.8,-2.55,2.72),(x,-2.55,2.72),(x+1.8,-4.65,3.37),(x+1.8,-2.55,3.37)],[(0,4,5,3),(0,1,4),(3,5,2)],'teal')
        box(x+1.8,-4.65,2.72,.035,2.1,.65,'glasslight')
    door(0,-5.1,.2,w=1.4,h=1.7)
    box(-1.65,-5.95,2.03,3.3,1,.15,'cream')
    for x in [-1.45,1.45]:beam((x,-5.75,.2),(x,-5.75,2.03),.04,'silver')
    paving(-1.5,-7.7,3,1.72,'path')
    paving(-1.5,-5.95,3,.85,'path')
    text('MEDICAL RESEARCH',0,-5.23,1.96,.21,'teal')
    # Glazed circulation remains open below the skybridge, with a quiet planted court.
    paving(-2.2,-2,3.5,7.9,'path')
    for x in [-1.65,.2]:planter(x,-.7,.6,1.7)
    for x,y in [(-6.5,-6.5),(6.5,-6.5),(6.5,-1.7)]:tree(x,y,size=.75,seed=int(x+y*3))
    lamp(-2.2,-6.8,1.8);lamp(2.2,-6.8,1.8)
