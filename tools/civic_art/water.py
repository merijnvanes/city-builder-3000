"""Four original water works: pumping, elevated storage, membranes and clarification."""
from power_common import pipe, ring, tank
from common import *


def valve(x,y,z,r=.15):
    beam((x,y,z-.2),(x,y,z),.035,'silver')
    ring(x,y,z,r,.025,'red')
    for a in [0,math.pi/2]:
        beam((x-r*math.cos(a),y-r*math.sin(a),z),(x+r*math.cos(a),y+r*math.sin(a),z),.015,'red')


def waterpump():
    base(4,'paving')
    # A small masonry wet-well house leaves its working pipe apron exposed.
    box(-1.45,-.1,.16,2.3,1.65,.22,'ivory')
    box(-1.35,0,.38,2.1,1.45,1.5,'brick')
    box(-1.42,-.07,1.83,2.24,1.59,.13,'cream')
    roof(-1.5,-.15,1.96,2.4,1.75,.65,'copper')
    door(-.77,-.02,.38,.55,1.22,'teal')
    window(.27,-.01,.84,.5,.69,lit=True)
    window(-.3,1.46,.9,.72,.67,side='back')
    window(.76,.74,.88,.6,.67,side='right')
    # Two teal pumps connect buried intake stubs to the wet well.
    for x in [-.62,.66]:
        box(x-.34,-1.47,.2,.68,1.08,.15,'ivory')
        pipe([(x,-1.64,.19),(x,-1.64,.65),(x,-.48,.65),(x,-.48,.4),(x,.02,.4)],.12,'teal')
        cyl(x,-.95,.64,.22,.32,'blue',24)
        cyl(x,-.95,.96,.24,.07,'silver',24)
        valve(x,-1.42,.96,.13)
    box(1.1,.62,.16,.46,.68,.67,'steel')
    for y in [.73,.87,1.01]:box(1.565,y,.36,.018,.07,.3,'dark')
    box(-1.13,-.12,1.64,.13,.07,.12,'lamp')


def watertower():
    base(4,'grass')
    paving(-.43,-1.76,.86,1.8,'path')
    # Four splayed columns and crossed ties carry the full tank perimeter.
    corners=[(-1,-1),(1,-1),(1,1),(-1,1)]
    for x,y in corners:
        box(x*1.22-.21,y*1.22-.21,.16,.42,.42,.25,'ivory')
        beam((x*1.22,y*1.22,.41),(x*.83,y*.83,3.8),.085,'cream')
    for i,(x,y) in enumerate(corners):
        xx,yy=corners[(i+1)%4]
        for z,s in [(1.0,1.15),(2.55,.97),(3.7,.84)]:
            beam((x*s,y*s,z),(xx*s,yy*s,z),.045,'steel')
        beam((x*1.15,y*1.15,1),(xx*.97,yy*.97,2.55),.028,'steel')
        beam((xx*1.15,yy*1.15,1),(x*.97,y*.97,2.55),.028,'steel')
    pipe([(.32,.3,.17),(.32,.3,4.1)],.115,'teal')
    cyl(0,0,3.55,.62,.42,'teal',64,r2=1.26)
    cyl(0,0,3.97,1.26,1.35,'teal',64)
    for z in [3.99,4.29,5.25]:ring(0,0,z,1.27,.035,'cream')
    cyl(0,0,5.32,1.31,.12,'cream',64,r2=1.25)
    dome(0,0,5.44,1.25,.42,'copper')
    cyl(0,0,5.86,.13,.19,'cream',20)
    cyl(0,0,6.05,.19,.08,'copper',24,r2=.08)
    # Access ladder and offset ground cabinet break rotational symmetry.
    for x in [-.17,.17]:beam((x,1.39,.25),(x,1.39,5.5),.023,'steel')
    for i in range(24):beam((-.17,1.39,.35+i*.215),(.17,1.39,.35+i*.215),.018,'steel')
    for z in [3.9,4.45,5.0]:ring(0,1.39,z,.3,.017,'steel')
    box(.7,-1.48,.16,.55,.5,.7,'ivory')
    box(.75,-1.5,.27,.45,.025,.45,'teal')
    box(.89,-1.53,.79,.12,.03,.08,'lamp')


def basin(x,y,r):
    # Real annular wall around a recessed water surface, never a capped tank.
    seg=64;verts=[]
    for radius,z in [(r,.18),(r,1.05),(r-.16,1.05),(r-.16,.38)]:
        verts += [(x+radius*math.cos(i*math.tau/seg),y+radius*math.sin(i*math.tau/seg),z) for i in range(seg)]
    faces=[]
    for j in range(3):
        for i in range(seg):faces.append((j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i))
    mesh('open concrete clarifier',verts,faces,'ivory')
    cyl(x,y,.57,r-.17,.025,'processwater',64)
    ring(x,y,1.06,r-.08,.085,'cream')
    cyl(x,y,.6,.22,.64,'teal',24)
    box(x-r+.03,y-.12,1.16,2*r-.06,.24,.07,'steel')
    for yy in [y-.14,y+.14]:
        beam((x-r+.07,yy,1.66),(x+r-.07,yy,1.66),.023,'cream')
        for xx in [x-r+.07,x,x+r-.07]:beam((xx,yy,1.21),(xx,yy,1.66),.022,'cream')
    cyl(x,y,1.25,.26,.24,'blue',24)


def treatment():
    base(12,'paving')
    material('processwater',(.085,.28,.25),rough=.22,metal=.15)
    basin(-2.7,-2.8,2.05);basin(2.35,-2.8,2.05)
    # Parallel aeration channels, with baffles and overhead blower mains.
    box(-5.05,.2,.16,6.4,3.7,.62,'ivory')
    for y in [.43,2.13]:
        box(-4.83,y,.8,5.96,1.43,.035,'processwater')
        for x in [-3.5,-1.75,0]:box(x,y,.81,.11,.97,.17,'cream')
        beam((-4.8,y+.73,1.3),(3.08,y+.73,1.3),.065,'teal')
        for x in [-4.4,-2.5,-.6,2.6]:beam((x,y+.73,.83),(x,y+.73,1.3),.035,'silver')
    building(3.65,.65,.16,1.6,3.55,1.75,'brick',floors=1,roofmat='slate')
    door(4.45,.61,.2,.68,1.3,'teal')
    for y in [1.45,2.65]:
        box(3.18,y,.2,.38,.65,.6,'blue')
        pipe([(3.36,y, .8),(3.36,y,1.3),(2.9,y,1.3)],.075)
    for x in [-2.7,2.35]:pipe([(x,-.8,.6),(x,-.3,.6),(x,.25,.6)],.12,'teal')
    paving(-5.15,4.4,10.3,.85,'path')
    lamp(-4.8,4.6,1.4)


def desalination():
    base(12,'paving')
    # A high clerestory process hall shields pumps; membrane skids are exposed
    # in the service court so the saltwater process reads differently to basins.
    building(-5.05,1.35,.16,7.0,3.7,2.65,'white',floors=1,pitched=False)
    box(-4.65,1.65,3.03,6.2,2.95,.42,'teal')
    for x in [-4,-2.65,-1.3,.05]:window(x,1.62,3.06,.95,.27,lit=x==-2.65)
    roof(-4.8,1.5,3.46,6.5,3.25,.48,'silver')
    door(.9,1.29,.2,.9,1.6,'teal')
    # Horizontal pressure vessels in two three-tier racks, with framed cradles.
    for x in [-3.6,-.6]:
        for yy in [-3.95,-.6]:
            for dx in [-.72,.72]:beam((x+dx,yy,.2),(x+dx,yy,2.25),.052,'steel')
            for z in [.48,1.16,1.84]:beam((x-.78,yy,z),(x+.78,yy,z),.04,'steel')
        for z in [.71,1.39,2.07]:
            for dx in [-.4,.4]:
                beam((x+dx,-4.12,z),(x+dx,-.46,z),.23,'white')
                for yy in [-4.14,-.44]:
                    beam((x+dx,yy-.035,z),(x+dx,yy+.035,z),.25,'teal')
                    pipe([(x+dx,yy,z),(x+.86,yy,z)],.065,'teal')
        pipe([(x+.86,-4.14,.2),(x+.86,-4.14,2.1)],.09,'teal')
        valve(x+.86,-4.14,2.35)
    # Intake filters and a separate clean-water tank complete the process train.
    for y in [-3.5,-1.65]:
        tank(3.15,y,.64,1.7,'teal')
        pipe([(3.15,y,2.0),(4.25,y,2.0),(4.25,y,.2)],.11)
    tank(3.95,3.22,1.18,2.4,'white')
    pipe([(3.95,2.02,.7),(3.95,.15,.7),(1.8,.15,.7)],.14,'teal')
    for x in [-4.65,-3.65]:
        pipe([(x,-5.45,.18),(x,-5.45,.58),(x,-4.7,.58),(x,-4.7,.2)],.18,'blue')
    lamp(1.75,-4.8,1.6)
