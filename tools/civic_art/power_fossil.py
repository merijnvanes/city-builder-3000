"""Fuel-specific power stations: coal handling, tank storage and gas turbines."""
from power_common import *
from sanitation import chimney, loading_door


def coal():
    yard()
    # Brick turbine house, taller boiler block and paired masonry flues.
    hall(-1.4,-2.8,6.3,7.5,3.1,'brick')
    roof(-1.56,-2.95,3.45,6.62,7.8,1.25,'slate')
    hall(-5.5,1.0,4,5.6,5.3,'brick')
    for x in [-5.0,-3.0]:chimney(x,5.7,.2,.48,8.3,'cream')
    for y in [1.8,3.4,5.0]:window(4.93,y,1.0,.8,1.35,side='right')
    loading_door(1.5,-2.92,1.8,2.0)
    # Concrete coal bunker: dark irregular stock, retaining walls, and a
    # raised belt climbing directly into the boiler house.
    box(-6.8,-5.65,.2,4.25,4.8,.18,'ivory')
    for x in [-6.8,-2.72]:box(x,-5.65,.38,.17,4.8,.8,'ivory')
    box(-6.8,-.99,.38,4.25,.17,.8,'ivory')
    for i,(x,y,r) in enumerate([(-5.6,-4.4,.95),(-4.15,-3.3,1.15),(-5.5,-2.2,.85)]):
        ball(x,y,.7,r,'dark',scale=(1,1,.7),sub=2)
        for j in range(5):ball(x+math.cos(j*2.4)*r*.6,y+math.sin(j*2.4)*r*.6,.85,.28,'slate',sub=1)
    a=Vector((-4.45,-2.4,1.35));b=Vector((-4.45,2.1,4.7))
    for dx in [-.43,.43]:beam(a+Vector((dx,0,0)),b+Vector((dx,0,0)),.065,'steel')
    belt=box(-4.82,-2.5,1.27,.74,(b-a).length,.12,'dark')
    # box rotates about its center; explicitly place the belt midpoint.
    belt.location=(a+b)/2;belt.rotation_euler.x=math.atan2(b.z-a.z,b.y-a.y)
    for t in [.2,.5,.8]:
        p=a.lerp(b,t)
        for dx in [-.4,.4]:beam((p.x+dx,p.y,.2),(p.x+dx,p.y,p.z),.05,'steel')
    control(3.8,-6.3,2.7,2)
    for y in [-.2,2.0,4.2]:transformer(6.3,y)
    lamp(2.4,-4.8,2)


def oil():
    yard()
    # Low ochre generating hall, one tall flue, and a bunded tank farm.
    hall(-6.5,.65,7.2,5.8,3.3,'ivory','copper')
    hall(-5.5,3.0,4.5,3.35,5.0,'clay','slate')
    stack(-5.5,5.15,8.1,.43)
    loading_door(-3.0,.53,1.6,1.85)
    box(1.3,-1.6,.2,5.7,8.2,.16,'paving')
    for x in [1.3,6.85]:box(x,-1.6,.36,.15,8.2,.55,'ivory')
    for y in [-1.6,6.45]:box(1.3,y,.36,5.7,.15,.55,'ivory')
    for y in [.35,4.35]:tank(4.05,y,1.65,2.35,'white')
    # Independent fuel lines connect the tanks to the generating hall.
    for y in [.35,4.35]:pipe([(2.38,y,.9),(1.0,y,.9),(1.0,2.0,.9),(.5,2.0,1.7)],.11,'clay')
    for x in [-4.8,-2.8,.0]:transformer(x,-3.0)
    control(-6.5,-6.4,3.3,2)
    for x in [-1.4,1.2]:
        pipe([(x,-5.8,.35),(x,-5.8,1.4),(x,-4.65,1.4),(x,-4.65,.35)],.09,'gold')
    lamp(5.8,-5.7,1.9)


def gas():
    yard(3)
    # Two parallel packaged turbines: ribbed intake filters at the front,
    # insulated exhaust ducts turning up into slender metal stacks.
    for x in [-3.05,.35]:
        hall(x,-1.75,2.35,5.4,1.8,'blue','silver')
        box(x-.05,-2.5,.4,2.45,.7,2.15,'silver')
        for z in [.7,.96,1.22,1.48,1.74,2.0,2.26]:box(x+.08,-2.54,z,2.19,.07,.055,'dark')
        pipe([(x+1.17,3.5,1.3),(x+1.17,4.2,1.3),(x+1.17,4.2,2.8)],.35,'silver')
        stack(x+1.17,4.2,5.7,.29)
    # Finned air cooler and yellow gas manifold distinguish the side yard.
    box(3.25,-1.7,.2,1.65,4.3,.75,'steel')
    for y in [-.9,.4,1.7]:
        cyl(4.08,y,.96,.57,.08,'dark',32)
        for a in [0,math.pi/2]:
            beam((4.08-.48*math.cos(a),y-.48*math.sin(a),1.07),(4.08+.48*math.cos(a),y+.48*math.sin(a),1.07),.035,'silver')
    for y in [-3.3,-3.7]:
        pipe([(-4.55,y,.3),(-4.55,y,.8),(2.3,y,.8),(2.3,-2.2,.8)],.07,'gold')
        for x in [-3.4,-.8,1.8]:box(x-.055,y-.09,.2,.11,.18,.48,'ivory')
    control(-4.8,-5.2,2.6,1.25)
    transformer(4.05,-4.3)
    lamp(-4.8,2.1,1.7)
