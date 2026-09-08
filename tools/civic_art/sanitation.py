from common import *

def industrial_yard():
    base();paving(-5.65,-5.65,11.3,11.3,'asphalt')
    for x in [-5.35,5.35]:fence(x,-3.7,0,9.0,.8,'steel')
    fence(-5.35,5.3,10.7,0,.8,'steel')
    for x in [-4.8,-2.8,-.8,1.2,3.2]:box(x,-5.0,.205,1.0,.035,.006,'yellow',0)

def chimney(x,y,z,r,h,band='ivory'):
    cyl(x,y,z,r,h,'brick',24,r2=r*.83)
    for zz in [h*.6,h*.82,h-.18]:cyl(x,y,z+zz,r*(1-.17*zz/h)+.025,.18,band,24)
    cyl(x,y,z+h,r*.87,.16,'steel',24);cyl(x,y,z+h+.165,r*.62,.007,'dark',24)
    # Service ladder and safety hoops are part of the industrial silhouette.
    for dx in [-.1,.1]:beam((x+dx,y-r-.08,z+.2),(x+dx,y-r*.86-.08,z+h-.1),.015,'steel')
    for i in range(int(h/.3)):
        zz=.25+i*.3;yy=y-r*(1-.17*zz/h)-.08;beam((x-.1,yy,z+zz),(x+.1,yy,z+zz),.012,'steel')

def loading_door(x,y,w=1.5,h=1.6):
    box(x-w/2-.09,y-.07,.2,w+.18,.12,h+.1,'ivory')
    box(x-w/2,y-.14,.2,w,.065,h,'steel')
    for i in range(int(h/.16)):box(x-w/2,y-.18,.25+i*.16,w,.012,.025,'dark',0)
    for dx in [-w/2-.17,w/2+.17]:cyl(x+dx,y-.25,.2,.055,.65,'yellow',10)

def landfill():
    base(4,'soil');paving(-1.7,-1.7,3.4,.8,'path')
    # Managed earth cells and a retaining wall: no fleet of cloned bulldozers
    # when the player drags a large landfill area.
    for i,(x,y,r) in enumerate([(-.95,.4,.75),(.5,.8,.8),(.65,-.45,.65)]):
        ball(x,y,.30,r,'soil',scale=(1,1,.5),sub=2)
        for j in range(9):
            a=j*2.4;xx=x+math.cos(a)*r*.6;yy=y+math.sin(a)*r*.6
            box(xx-.08,yy-.06,.45,.17,.13,.11,['ivory','steel','wood','cream'][j%4],.025)
    for x in [-1.75,1.65]:box(x,-.65,.16,.1,2.25,.45,'ivory')
    box(-1.75,1.6,.16,3.5,.1,.45,'ivory')
    fence(-1.75,-1.8,3.5,0,.5,'wood')
    for x in [-1.45,-.9]:ball(x,1.3,.2,.24,'grass',scale=(1,1,.65))


def incinerator():
    industrial_yard()
    # Old brick furnace house: sawtooth clerestories, soot-dark roof,
    # tall tapering masonry stacks, exposed ducts and roll-up loading bays.
    building(-4.5,-1.9,.2,6.1,6.15,3.45,'brick',floors=2,pitched=False)
    for x in [-4.6,-2.5,-.4]:
        roof(x,-2.03,3.95,2.15,6.4,.95,'slate')
        for y in [-1.2,.4,2,3.6]:window(x+.05,y,3.87,.48,.5,side='left')
    for x in [-3.2,-.55]:loading_door(x,-2.02,1.8,2)
    chimney(3.35,2.75,.2,.58,7.7,'ivory');chimney(3.5,.5,.2,.42,5.6,'cream')
    for y in [.5,2.75]:
        beam((1.6,y,2.8),(2.45,y,2.8),.19,'steel');beam((2.45,y,2.8),(2.45,y,1.7),.19,'steel');beam((2.45,y,1.7),(3.4,y,1.7),.19,'steel')
    box(2.3,-2.8,.2,2.1,1.9,.5,'ivory');box(2.48,-2.61,.7,1.74,1.52,.45,'steel')
    box(2.64,-2.45,1.16,1.42,1.2,.015,'dark');box(2.8,-2.4,1.17,.6,.5,.22,'soil')
    text('THERMAL WORKS',-1.45,-2.08,2.75,.27,'cream');lamp(-4.9,-3.1,2)


def recycling():
    industrial_yard()
    # A clean circular-economy workshop: a green folded roof, translucent
    # clerestories, timber rainscreen and labeled sorting portals.
    box(-4.5,-.75,.2,9,5.15,2.65,'ivory')
    for x in [-4.6,-1.55,1.5]:
        roof(x,-.9,2.85,3.1,5.5,1,'copper')
        box(x+.13,-.93,2.92,2.75,.045,.42,'glasslight')
        for xx in [x+.55,x+1.55,x+2.55]:box(xx,-.99,2.9,.045,.09,.5,'cream')
    for i,x in enumerate([-3.3,-1.1,1.1,3.3]):
        col=['blue','gold','copper','red'][i]
        box(x-.91,-.88,.2,1.82,.16,2.25,col)
        loading_door(x,-.95,1.55,1.65)
        text(['PAPER','GLASS','METAL','SORT'][i],x,-1.1,2.18,.2,'cream')
        # Open topped industrial skips have walls, actual depth and contents.
        box(x-.78,-3.62,.2,1.56,1.5,.12,'steel')
        for xx in [x-.78,x+.68]:box(xx,-3.62,.32,.1,1.5,.68,col)
        for yy in [-3.62,-2.22]:box(x-.78,yy,.32,1.56,.1,.68,col)
        for j in range(4):box(x-.55+(j%2)*.62,-3.38+(j//2)*.52,.34,.45,.38,.25,['ivory','glasslight','silver','wood'][i],.05)
    # One modest solar array, placed on a roof plane rather than a giant icon.
    for i in range(4):
        o=box(-.95,-.25+i*.95,3.72,.9,.78,.045,'blue');o.rotation_euler.y=-.54
    for y in [.2,1.15,2.1,3.05]:window(4.51,y,.75,.62,1.15,side='right')
    planter(-5.05,-4.85,1.5,.65,True);tree(4.9,4.9,size=.7,seed=23)


def wasteenergy():
    industrial_yard()
    # Modern district-energy works: a sculpted blue boiler hall, glazed
    # turbine gallery, insulated stainless stack and a visible heat exchanger.
    building(-4.65,-1.8,.2,5.4,6.3,4.85,'teal',floors=3,pitched=False)
    roof(-4.78,-1.93,5.4,5.66,6.56,1.0,'blue')
    for x in [-4.7,-3.65,-2.6,-1.55,-.5,.65]:box(x,-1.9,.2,.065,.14,4.85,'silver')
    box(1.05,-2.5,.2,3.6,5.2,2.5,'glass')
    for x in [1.1,2.2,3.3,4.4]:box(x,-2.56,.2,.07,5.35,2.65,'silver')
    for z in [.35,1.4,2.7]:box(1,-2.6,z,3.7,5.4,.08,'silver')
    box(.95,-2.65,2.82,3.8,5.5,.12,'ivory')
    for y in [-1.4,.15,1.7]:
        cyl(2.95,y,.4,.55,1.25,'silver',24);cyl(2.95,y,1.65,.62,.12,'teal',24)
    cyl(3.55,3.9,.2,.5,8.25,'silver',24,r2=.36)
    for z in [1.7,4.9,7.8]:cyl(3.55,3.9,z,.5-.14*z/8.25+.035,.18,'teal',24)
    cyl(3.55,3.9,8.45,.39,.16,'silver',24);cyl(3.55,3.9,8.62,.27,.005,'dark',24)
    # Twin orange district-heating pipes with deliberate bends and supports.
    for yy in [-3.4,-3.85]:
        beam((-3.6,yy,.9),(.4,yy,.9),.12,'clay');beam((.4,yy,.9),(.4,yy,2),.12,'clay');beam((.4,yy,2),(1.7,yy,2),.12,'clay')
        for x in [-3.4,-1.5,.2]:box(x-.06,yy-.1,.2,.12,.2,.65,'ivory')
    text('DISTRICT ENERGY',-1.95,-2.03,4.1,.24,'cream');lamp(-5,-3.2,2)
