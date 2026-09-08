"""An open stadium bowl and a marina with sculpted hulls and useful jetties."""
from common import *


def ellipse_band(rx,ry,outerx,outery,z,h,mat,segments=64):
    verts=[]
    for zz in [z,z+h]:
        for x,y in [(rx,ry),(outerx,outery)]:
            verts += [(math.cos(i*math.tau/segments)*x,math.sin(i*math.tau/segments)*y,zz) for i in range(segments)]
    faces=[]
    # A continuous entrance aisle cuts through the bowl, between the ticket kiosks.
    opening={i for i in range(segments) if abs((i+.5)*math.tau/segments-math.pi*1.5)<math.pi/16}
    for i in range(segments):
        if i in opening:continue
        j=(i+1)%segments
        if (i-1)%segments in opening:faces.append((i,segments+i,3*segments+i,2*segments+i))
        if j in opening:faces.append((j,2*segments+j,3*segments+j,segments+j))
        faces += [(i,j,segments+j,segments+i),(2*segments+i,3*segments+i,3*segments+j,2*segments+j),(i,2*segments+i,2*segments+j,j),(segments+i,segments+j,3*segments+j,3*segments+i)]
    return mesh('stadium tier',verts,faces,mat)


def arena(seat):
    base(20,'paving')
    colors=[(.17,.41,.44),(.35,.58,.6)] if seat=='teal' else [(.49,.24,.19),(.68,.4,.31)]
    for i,color in enumerate(colors):material(f'stadium-seat-{i}',color)
    material('stadium-floodlight',(.95,.84,.63),emission=20)
    # A striped pitch inside an elliptical seating bowl.
    box(-3.2,-4.5,.2,6.4,9,.09,'grass')
    for i in range(10):box(-3.2,-4.5+i*.9,.29,6.4,.9,.015,'leaf' if i%2 else 'grass')
    def marking(a,b):beam((*a,.32),(*b,.32),.025,'white')
    for a,b in [((-3.05,-4.35),(3.05,-4.35)),((-3.05,4.35),(3.05,4.35)),((-3.05,-4.35),(-3.05,4.35)),((3.05,-4.35),(3.05,4.35)),((-3.05,0),(3.05,0))]:marking(a,b)
    for i in range(32):
        a=i*math.tau/32;b=(i+1)*math.tau/32
        marking((math.cos(a)*.88,math.sin(a)*.88),(math.cos(b)*.88,math.sin(b)*.88))
    for direction in [-1,1]:
        y=direction*4.35;inner=direction*2.95
        for a,b in [((-1.7,y),(-1.7,inner)),((1.7,y),(1.7,inner)),((-1.7,inner),(1.7,inner))]:marking(a,b)
        for x in [-.8,.8]:beam((x,y,.32),(x,y,1.08),.035,'white')
        beam((-.8,y,1.08),(.8,y,1.08),.035,'white')
        for x in [-.8,-.4,0,.4,.8]:beam((x,y,1.08),(x,y+direction*.4,.32),.008,'cream')
    for tier in range(6):
        rx,ry=5.0+tier*.47,6.05+tier*.43
        ellipse_band(rx,ry,rx+.49,ry+.45,.2,.45+tier*.34,'ivory')
        ellipse_band(rx+.07,ry+.07,rx+.36,ry+.32,.66+tier*.34,.07,f'stadium-seat-{tier%2}')
    # Radial aisles are actual gaps in the seat color and maintain safe access.
    for angle in [i*math.tau/12 for i in range(12)]:
        for tier in range(6):
            x=math.cos(angle)*(5.25+tier*.47);y=math.sin(angle)*(6.28+tier*.43)
            o=box(x-.2,y-.23,.74+tier*.34,.4,.46,.025,'cream');o.rotation_euler.z=angle
    # Open-sided roof segments over the long stands preserve the visible pitch.
    for side in [-1,1]:
        for y in [-4,-2,0,2,4]:
            x=side*(7.9-.07*y*y)
            beam((x,y,.2),(x,y,3.7),.065,'steel')
            beam((x,y,3.7),(x-side*1.25,y,3.9),.055,'steel')
        mesh('cantilever stand roof',[(side*7.8,-4.7,3.7),(side*7.8,4.7,3.7),(side*6.05,4.7,3.98),(side*6.05,-4.7,3.98)],[(0,1,2,3)],'cream')
    for x in [-8.75,8.75]:
        for y in [-8.55,8.55]:
            beam((x,y,.2),(x,y,5.55),.08,'steel')
            box(x-.55,y-.15,5.55,1.1,.3,.5,'slate')
            for dx in [-.36,0,.36]:ball(x+dx,y+(.17 if y<0 else -.17),5.8,.115,'stadium-floodlight',scale=(1,.45,1))
    # Two entrance pavilions and an external concourse provide a legible way in.
    for x in [-2.5,1.0]:
        box(x,-9.55,.2,1.5,.8,.9,'ivory')
        box(x+.1,-9.58,.25,1.3,.05,.62,'teal')
        box(x-.08,-9.63,1.1,1.66,.96,.12,'cream')
    box(-1.8,8.15,2.75,3.6,.16,1.05,'slate')
    text('CITY STADIUM',0,8.04,3.34,.23,'lamp')


def stadium():arena('teal')
def stadium_red():arena('red')


def yacht(x,y):
    # Pointed, tapered hulls, a low cabin and taut rigging avoid block-boat silhouettes.
    verts=[(x,y-.95,.35),(x-.43,y-.5,.35),(x-.38,y+.7,.35),(x+.38,y+.7,.35),(x+.43,y-.5,.35),(x,y-.82,.15),(x-.25,y+.58,.15),(x+.25,y+.58,.15)]
    mesh('yacht hull',verts,[(0,1,2,3,4),(0,5,6,2,1),(2,6,7,3),(3,7,5,0,4)],'white')
    box(x-.28,y-.35,.36,.56,.85,.06,'wood')
    box(x-.23,y-.06,.42,.46,.45,.25,'cream')
    box(x-.18,y-.08,.53,.36,.025,.11,'glasslight')
    beam((x,y-.45,.37),(x,y-.45,2.65),.023,'silver')
    beam((x,y-.45,2.55),(x,y+.65,.38),.009,'cream')
    beam((x,y-.45,2.55),(x,y-.89,.37),.009,'cream')
    beam((x,y-.4,.85),(x,y+.48,.85),.018,'silver')


def marina():
    base(12,'water')
    box(-5.8,-5.8,.16,11.6,3.6,.16,'path')
    building(-5.1,-5.15,.32,4.8,1.9,2.05,'cream',floors=1,roofmat='copper')
    door(-2.7,-5.15,.32,w=.9,h=1.55)
    door(-2.7,-3.25,.32,w=.9,h=1.55,face='back')
    paving(-3.25,-5.78,1.1,.63,'paving',z=.32)
    # A generous quayside walk behind the piers; the clubhouse door reaches the street.
    for x in [-3.7,0,3.7]:
        box(x-.23,-2.2,.26,.46,7.1,.15,'wood')
        for y in [.2,2.75]:
            box(x-1.6,y,.26,1.83,.22,.15,'wood')
            yacht(x-1.0,y-1.0)
            for yy in [y-.05,y+.17]:cyl(x-.13,yy,.41,.035,.25,'silver',8)
        for i in range(32):box(x-.23,-2.1+i*.21,.415,.46,.018,.015,'path',0)
        for y in [-2.1,1,4.7]:cyl(x,y,.02,.085,.3,'wood',10)
    for x in [-5.5,-1.8,1.85,5.4]:
        cyl(x,-2.3,.32,.065,.6,'white',12)
        ball(x,-2.3,.94,.07,'lamp')
    # A small seating terrace sits entirely on dry land and faces the basin.
    paving(1,-4.8,3.6,1.3,'paving',z=.32)
    bench(2,-4.1,math.pi);bench(3.8,-4.1,math.pi)
    tree(5,-4.8,z=.32,size=.7,seed=17)
    beam((.6,-4.5,.32),(.6,-4.5,3.2),.035,'silver')
    mesh('harbor pennant',[(.6,-4.5,3.15),(1.2,-4.5,2.98),(.6,-4.5,2.8)],[(0,1,2)],'teal')
