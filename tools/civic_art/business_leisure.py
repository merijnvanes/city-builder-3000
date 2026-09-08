"""Entertainment and retail, with palette variance carried by architecture."""
from common import *

PALETTES=['cream','blue','bricklight','teal','purple']

def casino_variant(v=0):
    base(12,'paving'); accent=PALETTES[v]
    # Stepped Art Deco hotel rises from a rounded entertainment podium.
    building(-4.7,-.5,.2,9.4,4.5,2.25,'ivory',floors=1,pitched=False)
    building(-3.5,1.2,2.45,7,2.5,3.7,accent,floors=3,pitched=False)
    building(-2.2,1.55,6.15,4.4,1.85,1.15,'cream',floors=1,pitched=False)
    for x in [-3.25,-2.45,-1.65,1.65,2.45,3.25]:box(x,1.14,2.5,.1,.13,3.8,'gold')
    cyl(0,-.45,.2,2,2.3,'purple',32)
    for a in range(195,351,26):
        angle=math.radians(a);x,y=1.99*math.cos(angle),-.45+1.99*math.sin(angle)
        beam((x,y,.4),(x,y,2.15),.04,'gold')
    box(-2.25,-2.65,2.4,4.5,2.15,.18,'gold')
    box(-2.1,-2.5,2.58,4.2,1.85,.32,accent)
    text('CASINO',0,-2.54,2.76,.44,'lamp')
    for x in [-1.65,-.55,.55,1.65]:box(x-.11,-2.68,2.38,.22,.06,.04,'lamp')
    door(0,-2.48,.2,w=1.3,h=1.8)
    paving(-1.2,-5.9,2.4,3.3,'path')
    for x in [-4.65,3.3]:planter(x,-4.7,1.35,1.1,flowers=True)
    for x in [-3.25,3.25]:lamp(x,-3.1,2.2)
    door(0,4,.2,w=1.2,h=1.7,face='back')
    paving(-.9,4,1.8,1.8)
    for x in [-3,3]:box(x-.4,2.1,6.3,.8,.75,.32,'steel')


def gigamall_variant(v=0):
    base(16,'paving');accent=PALETTES[v]
    building(-7,-.7,.2,14,7.1,2.5,'cream',floors=1,pitched=False)
    # Broad shopfront glazing reads as retail at city scale.
    for x in [-5.5,-3.35,3.35,5.5]:
        box(x-.85,-.81,.4,1.7,.07,1.45,'glasslight')
        for dx in [-.85,0,.85]:box(x+dx,-.87,.4,.05,.07,1.45,'silver')
    # A longitudinal glass lantern and clearly expressed anchor stores.
    for x in [-6.7,3.5]:building(x,.3,2.7,3.2,5.8,.8,accent,floors=1,pitched=False)
    box(-1.75,-.5,2.7,3.5,6.6,.7,'glasslight')
    roof(-1.8,-.55,3.4,3.6,6.7,.72,'glass')
    for y in [-.4,.9,2.2,3.5,4.8,6]:
        beam((-1.8,y,3.4),(0,y,4.12),.035,'silver');beam((0,y,4.12),(1.8,y,3.4),.035,'silver')
    box(-6.8,-1.5,2.2,13.6,1,.18,accent)
    for x in [-6,-4.5,4.5,6]:cyl(x,-1.2,.2,.08,2,'steel')
    door(0,-.7,.2,w=1.8,h=1.85)
    text('GALLERIA',0,-1.53,2.33,.31,'gold')
    paving(-1.15,-7.9,2.3,6.4,'path')
    for x in [-6.8,2.1]:
        paving(x,-7.2,4.7,4.8,'asphalt')
        for dx in [.2,1.3,2.4,3.5,4.6]:box(x+dx,-7.05,.195,.028,1.5,.012,'white')
        planter(x,-2.15,4.7,.5)
    # Loading doors and service apron are on the rear elevation.
    paving(-6.8,6.4,13.6,1.35,'asphalt')
    for x in [-4.8,4.8]:
        box(x-.85,6.42,.2,1.7,.05,1.6,'steel')
        box(x-.95,6.45,.2,1.9,.5,.12,'paving')
    for x in [-1.5,1.5]:lamp(x,-5.5,2.2)

for name,count,fn in [('casino',4,casino_variant),('gigamall',5,gigamall_variant)]:
    for i in range(count):globals()[name if i==0 else f'{name}_v{i}']=lambda i=i,fn=fn:fn(i)
