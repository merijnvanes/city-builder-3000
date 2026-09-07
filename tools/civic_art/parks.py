"""Landscaped public gardens and a zoological park, authored at game scale."""
from common import *


def oval(x,y,z,rx,ry,mat,h=.06):
    o=cyl(x,y,z,1,h,mat,64);o.scale.x=rx;o.scale.y=ry
    return o


def rock(x,y,z,size=1):
    return ball(x,y,z,size,'paving',scale=(1,.8,.63),sub=1)


def pocket_ground():
    base(4)
    # Keep intersections disjoint and paths aligned between neighboring lots.
    paving(-.32,-1.79,.64,1.47,'path')
    paving(-.32,.32,.64,1.47,'path')
    paving(-1.79,-.32,3.58,.64,'path')


def park():
    pocket_ground()
    tree(-1.08,1.04,size=.8,seed=51)
    tree(1.1,-1.06,size=.66,seed=52)
    planter(-1.56,-1.5,1.05,.72,True)
    planter(.54,.75,1.0,.64,True)
    # A raised stone bowl with recessed water and a small upper dish.
    cyl(0,0,.2,.59,.14,'ivory',40)
    cyl(0,0,.34,.49,.045,'water',40)
    from power_common import ring
    ring(0,0,.39,.53,.065,'cream')
    cyl(0,0,.38,.09,.46,'cream',20)
    cyl(0,0,.84,.27,.08,'ivory',32,r2=.31)
    cyl(0,0,.92,.23,.018,'water',32)
    cyl(0,0,.94,.035,.18,'cream',16)
    bench(.95,.35,math.pi)
    lamp(-.6,-.45,1.15)


def park_gazebo():
    pocket_ground()
    # A sheltered corner rather than a recolored fountain layout.
    box(-1.58,.43,.16,1.25,1.2,.2,'ivory')
    for x in [-1.46,-.45]:
        for y in [.55,1.52]:cyl(x,y,.36,.045,1.25,'cream',12)
    hip(-1.69,.32,1.61,1.47,1.42,.62,'copper')
    ball(-.955,1.03,2.25,.045,'gold')
    bench(-.96,1.1)
    tree(1.02,.97,size=.8,seed=54)
    tree(1.12,-1.07,size=.62,seed=55)
    planter(-1.57,-1.5,1.05,.65,True)
    bench(.92,.37,math.pi)
    lamp(-.56,-.53,1.15)


def park_playground():
    pocket_ground()
    # Real A-frame swing legs, hanging chains and a seat over a sandy patch.
    paving(-1.62,.38,1.25,1.3,'soil')
    box(-1.56,.44,.21,1.13,1.18,.025,'path')
    for x in [-1.5,-.49]:
        for y in [.54,1.5]:beam((x,y,.24),(x,1.02,1.56),.045,'teal')
    beam((-1.62,1.02,1.56),(-.38,1.02,1.56),.065,'wood')
    for x in [-1.18,-.8]:beam((x,1.02,1.53),(x,1.02,.61),.012,'steel')
    box(-1.25,.89,.55,.52,.26,.065,'red')
    # A low slide occupies the opposite corner, with its own little ladder.
    box(.52,-1.53,.2,1.07,1.03,.035,'path')
    for x in [.65,1.12]:beam((x,-.65,.23),(x,-.65,.93),.035,'wood')
    box(.59,-.81,.93,.6,.33,.06,'wood')
    mesh('sloping playground slide',[(.63,-.82,.97),(1.14,-.82,.97),(1.14,-1.51,.3),(.63,-1.51,.3)],[(0,1,2,3)],'silver')
    for x in [.61,1.16]:beam((x,-.81,1.03),(x,-1.52,.36),.035,'red')
    for x in [.7,1.06]:beam((x,-.39,.23),(x,-.65,.95),.025,'wood')
    for i in range(3):beam((.7,-.44-i*.06,.39+i*.19),(1.06,-.44-i*.06,.39+i*.19),.018,'wood')
    tree(1.04,1.02,size=.86,seed=56)
    tree(-1.12,-1.13,size=.58,seed=57)
    bench(.95,.4,math.pi)
    lamp(-.57,-.48,1.15)


def bandstand(x,y):
    cyl(x,y,.16,1.65,.18,'ivory',8)
    cyl(x,y,.34,1.49,.18,'wood',8)
    for i in range(8):
        a=math.pi/8+i*math.tau/8;xx=x+1.3*math.cos(a);yy=y+1.3*math.sin(a)
        cyl(xx,yy,.52,.065,1.95,'cream',12)
        cyl(xx,yy,2.4,.1,.14,'cream',12)
        if i not in [4,5]:
            b=a+math.tau/8;nx=x+1.3*math.cos(b);ny=y+1.3*math.sin(b)
            beam((xx,yy,1.04),(nx,ny,1.04),.035,'cream')
            for f in [.25,.5,.75]:beam((xx+(nx-xx)*f,yy+(ny-yy)*f,.54),(xx+(nx-xx)*f,yy+(ny-yy)*f,1.04),.017,'cream')
    cyl(x,y,2.5,1.7,.12,'cream',8)
    cyl(x,y,2.62,1.8,.8,'copper',8,r2=.36)
    for i in range(8):
        a=i*math.tau/8
        beam((x+1.8*math.cos(a),y+1.8*math.sin(a),2.64),(x+.36*math.cos(a),y+.36*math.sin(a),3.44),.018,'copper')
    cyl(x,y,3.42,.38,.2,'copper',8,r2=.14)
    cyl(x,y,3.62,.03,.33,'gold')
    ball(x,y,3.97,.065,'gold')
    for z,w in [(.16,1.3),(.25,1.1),(.34,.9)]:box(x-w/2,y-1.9+(z-.16)*2,z,w,.24,.09,'ivory')
    ball(x,y,2.35,.08,'lamp')


def pond(x,y,rx,ry):
    oval(x,y,.17,rx+.13,ry+.13,'ivory')
    oval(x,y,.235,rx,ry,'water')
    for dx,dy in [(-.45,.1),(.25,.38),(.55,-.28)]:
        oval(x+dx*rx,y+dy*ry,.30,.15,.12,'leafdark',.015)
        ball(x+dx*rx,y+dy*ry,.34,.05,'white')
    for i in range(7):
        a=i*.18+.15;xx=x+rx*math.cos(a);yy=y+ry*math.sin(a)
        beam((xx,yy,.25),(xx-.06,yy+.05,.65+(i%3)*.1),.015,'hedge')


def largepark():
    base(12)
    # A quiet lawn crossed by walks: pavilion, pond and groves each have space.
    paving(-.55,-5.78,1.1,5.2,'path')
    paving(-.55,.58,1.1,5.2,'path')
    paving(-5.78,-.58,11.56,1.16,'path')
    oval(-2.7,2.5,.17,2.15,2.15,'path')
    bandstand(-2.7,2.5)
    pond(2.75,2.65,1.8,1.5)
    paving(2.17,.55,.72,.66,'path')
    for x,y,sz,seed in [(-4.6,-4.2,1.3,60),(-2.7,-4.55,1.02,61),(-4.4,-2.3,.8,62),(4.45,-4.25,1.15,63),(4.7,4.7,.83,64),(1.4,4.9,.7,65)]:tree(x,y,size=sz,seed=seed)
    # Rose walk and a pergola form a sheltered seating garden.
    for x in [1.25,4.5]:
        for y in [-3.05,-1.25]:box(x,y,.17,.12,.12,1.95,'wood')
    for y in [-3.12,-1.27]:box(1.15,y,2.12,3.6,.17,.17,'wood')
    for x in [1.15+i*.37 for i in range(10)]:box(x,-3.25,2.29,.1,2.25,.12,'cream')
    bench(2.95,-2.7)
    for x in [1.3,3.6]:planter(x,-3.65,1,.45,True)
    bench(-1.75,-1.0,math.pi);bench(2.5,4.75,math.pi)
    for x,y in [(-.87,-4.6),(.86,1.15),(-4.8,.82)]:lamp(x,y,1.5)
    # Low entrance piers frame the walk without a perimeter wall.
    for x in [-.95,.72]:
        box(x,-5.45,.16,.23,.35,.62,'ivory');box(x-.035,-5.485,.78,.3,.42,.08,'cream')


def elephant(x,y):
    # Rounded torso, four weight-bearing legs, broad ears and a curling trunk.
    mat='elephant'
    for dx in [-.47,.43]:
        for dy in [-.34,.34]:cyl(x+dx,y+dy,.23,.16,.77,mat,12,r2=.13)
    ball(x,y,1.02,.75,mat,scale=(1.25,.7,.8),sub=3)
    ball(x-.78,y,1.27,.45,mat,scale=(.8,.85,1),sub=3)
    for dy in [-.37,.37]:ball(x-.59,y+dy,1.29,.34,mat,scale=(.62,.2,1.03),sub=3)
    for a,b,r in [((x-1.07,y,1.26),(x-1.17,y,.64),.13),((x-1.17,y,.64),(x-1.37,y,.4),.09),((x-1.37,y,.4),(x-1.58,y,.53),.065)]:beam(a,b,r,mat)
    for dy in [-.29,.29]:ball(x-.97,y+dy,1.44,.035,'dark')
    beam((x+.85,y,1.07),(x+1.05,y,.58),.035,mat)


def giraffe(x,y):
    for dx in [-.35,.35]:
        for dy in [-.23,.23]:beam((x+dx,y+dy,.22),(x+dx,y+dy,1.2),.065,'ochre')
    ball(x,y,1.36,.5,'ochre',scale=(1.35,.62,.65),sub=2)
    beam((x-.39,y,1.45),(x-.72,y,2.55),.17,'ochre')
    ball(x-.83,y,2.62,.23,'ochre',scale=(1.35,.65,.8),sub=2)
    for dy in [-.13,.13]:
        beam((x-.71,y+dy,2.73),(x-.69,y+dy,2.9),.03,'wood')
        ball(x-.71,y+dy*1.65,2.68,.075,'ochre',scale=(1,1,.4))
        ball(x-.96,y+dy,2.65,.027,'dark')
    for z in [1.58,1.88,2.18,2.45]:
        xx=x-.39-(z-1.45)*.3
        for dy in [-.14,.14]:ball(xx,y+dy,z,.067,'wood',scale=(.8,.18,1.2))
    for dx in [-.3,0,.3]:
        for dy in [-.29,.29]:ball(x+dx,y+dy,1.38,.09,'wood',scale=(1,.13,1))
    beam((x+.61,y,1.42),(x+.76,y,.86),.025,'wood')


def habitat(x,y,w,d):
    box(x,y,.16,w,d,.07,'soil')
    box(x+.18,y+.18,.23,w-.36,d-.36,.025,'sand')
    # Low masonry sill plus open rails preserves animal visibility.
    for xx,yy,ww,dd in [(x,y,w,0),(x,y+d,w,0),(x,y,0,d),(x+w,y,0,d)]:
        if ww:box(xx,yy-.06,.23,ww,.12,.2,'ivory')
        else:box(xx-.06,yy,.23,.12,dd,.2,'ivory')
        n=max(1,int((ww+dd)/.85))
        for i in range(n+1):beam((xx+ww*i/n,yy+dd*i/n,.4),(xx+ww*i/n,yy+dd*i/n,1.08),.035,'wood')
        for z in [.72,1.07]:beam((xx,yy,z),(xx+ww,yy+dd,z),.025,'steel')


def zoo():
    base(16)
    material('sand',(.66,.51,.29),texture='stone')
    material('ochre',(.72,.43,.13))
    material('elephant',(.38,.41,.39))
    paving(-7.45,-7.35,14.9,2,'path')
    paving(-.65,-5.35,1.3,5.5,'path')
    paving(-.65,1.2,1.3,6.25,'path')
    paving(-7.45,.15,14.9,1.05,'path')
    # Twin gate lodges and a broad arched canopy announce a public zoo.
    for x in [-3.6,1.35]:
        building(x,-6.85,.16,2.25,1.75,1.8,'brick',floors=1,roofmat='copper')
    for x in [-1.12,1.0]:box(x,-6.25,.16,.14,.45,2.6,'ivory')
    verts=[]
    for y in [-6.4,-5.7]:
        for i in range(17):
            xx=-1.3+i*2.6/16;verts.append((xx,y,2.48+.45*math.sqrt(max(0,1-(xx/1.3)**2))))
    mesh('arched entry canopy',verts,[(i,i+1,i+18,i+17) for i in range(16)],'copper')
    text('ZOO',0,-6.43,2.63,.4,'cream')
    # Two open habitat yards with shelters, forage and a shallow wallow.
    habitat(-6.8,1.8,5.45,4.95)
    habitat(1.4,1.8,5.4,4.95)
    elephant(-3.6,3.4)
    pond(-5.05,5.15,1.05,.63)
    giraffe(3.3,3.35);giraffe(5.2,4.4)
    for x in [-3.3,4.25]:
        for xx in [x-.9,x+.9]:
            for y in [5.6,6.5]:beam((xx,y,.23),(xx,y,1.8),.065,'wood')
        roof(x-1.1,5.4,1.8,2.2,1.3,.65,'clay')
    # Front habitats: an airy aviary and a rocky penguin pool.
    pond(3.6,-2.25,2.05,1.5)
    for x,y,s in [(2.4,-1.6,.55),(3.2,-1.2,.63),(4.7,-1.6,.55)]:rock(x,y,.48,s)
    for x,y in [(2.45,-1.6),(3.18,-1.2),(4.72,-1.6)]:
        ball(x,y,.94,.14,'slate',scale=(.85,.8,1.7))
        ball(x,y-.1,.96,.105,'white',scale=(.8,.24,1.4))
        ball(x,y,1.17,.1,'slate');beam((x,y-.07,1.16),(x,y-.18,1.14),.04,'gold')
    oval(-4.05,-2.3,.17,2.15,1.9,'ivory')
    oval(-4.05,-2.3,.24,1.97,1.72,'grass')
    for i in range(16):
        a=i*math.tau/16
        points=[(-4.05+2*math.cos(a)*math.cos(j*math.pi/16),-2.3+1.75*math.sin(a)*math.cos(j*math.pi/16),.28+2.65*math.sin(j*math.pi/16)) for j in range(9)]
        for a1,b1 in zip(points,points[1:]):beam(a1,b1,.023,'steel')
    for z,r in [(1,.96),(1.8,.82),(2.4,.55)]:
        pts=[(-4.05+2*r*math.cos(i*math.tau/48),-2.3+1.75*r*math.sin(i*math.tau/48),z) for i in range(49)]
        for a,b in zip(pts,pts[1:]):beam(a,b,.018,'steel')
    tree(-4.1,-2.1,size=.75,seed=81)
    for x,y in [(-5,-2.7),(-3.4,-1.8)]:
        beam((x,y,.25),(x,y,.7),.014,'gold');ball(x,y,.8,.13,'red',scale=(1.4,.7,.8));beam((x+.14,y,.82),(x+.2,y,.74),.028,'dark')
    for x,y,sz,seed in [(-7,-4.55,1.0,82),(6.65,-4.45,.95,83),(-7.0,7.05,.72,84),(7,7.05,.72,85)]:tree(x,y,size=sz,seed=seed)
    for x in [-5.4,5.5]:bench(x,-6.25);lamp(x,-5.45,1.55)
    lamp(-.9,1,1.65)
