from common import *

def fire():
    base(); paving(-5.65,-5.65,11.3,5.1,'asphalt');paving(-5.65,-.4,1.8,5.9)
    # An early twentieth-century brick firehouse, deep arched engine portals,
    # a slate mansard roof, and a working hose-drying tower.
    box(-3.6,-1.6,.2,8.3,6.1,3.9,'brick')
    for z in [.3,2.55,3.75]:box(-3.68,-1.68,z,8.46,6.26,.15,'ivory')
    roof(-3.8,-1.8,4.1,8.7,6.5,1.45,'slate')
    for i,x in enumerate([-2.3,.45,3.15]):
        box(x-1.08,-1.76,.2,2.16,.15,2.35,'ivory')
        box(x-.94,-1.88,.2,1.88,.075,2.16,'dark')
        box(x-.85,-1.93,.25,1.7,.07,1.92,'red')
        for j in range(7):box(x-.82,-1.98,.33+j*.23,1.64,.025,.025,'bricklight',0)
        for dx in [-.56,0,.56]:box(x+dx-.21,-2.0,1.38,.42,.016,.32,'glasslight',.015)
        # Recessed arched fanlight and individual wedge-cut masonry blocks.
        arc=[(x,-1.94,2.30)]+[(x+math.cos(j/16*math.pi)*.92,-1.94,2.30+math.sin(j/16*math.pi)*.43) for j in range(17)]
        mesh('dark arched fanlight',arc,[(0,j+1,j+2) for j in range(16)],'glass')
        for j in range(11):
            a=j/11*math.pi+.018;b=(j+1)/11*math.pi-.018
            ring=[(x+math.cos(a)*.94,2.30+math.sin(a)*.45),(x+math.cos(b)*.94,2.30+math.sin(b)*.45),(x+math.cos(b)*1.09,2.30+math.sin(b)*.62),(x+math.cos(a)*1.09,2.30+math.sin(a)*.62)]
            verts=[(xx,yy,zz) for yy in [-1.99,-1.77] for xx,zz in ring]
            stone=mesh('arch voussoir',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'cream')
            bevel=stone.modifiers.new('worn stone arris','BEVEL');bevel.width=.012;bevel.segments=2
        text(f'0{i+1}',x,-2.035,2.06,.18,'cream')
        box(x-.9,-4.7,.205,.035,2.4,.008,'yellow',0);box(x+.865,-4.7,.205,.035,2.4,.008,'yellow',0)
        window(x,-1.73,3,.5,.65,lit=i==1)
    for yy in [0,1.45,2.9]:window(4.71,yy,1.25,side='right');window(4.71,yy,2.8,side='right')
    # Tower joins the rear corner; deep louvers and broad eaves give real mass.
    building(-5.1,1.2,.2,2.45,3.25,6.1,'brick',floors=3,pitched=False)
    box(-5.18,1.12,5.8,2.61,3.41,.16,'cream')
    for side in ['front','back']:
        yy=1.1 if side=='front' else 4.48
        for j in range(5):box(-4.7,yy,5.08+j*.14,1.65,.11,.06,'slate')
    hip(-5.32,.98,6.65,2.89,3.69,1.15,'slate')
    cyl(-3.875,2.825,7.8,.075,.22,'gold')
    box(-3.1,-1.85,3.72,6.9,.1,.32,'red');text('FIRE STATION',.35,-1.96,3.88,.27,'cream')
    # Dormers, ridge vents, chimney and gutter downpipes.
    for yy in [-.7,1.4,3.5]:
        box(.4,yy,5.15,1.05,.8,.8,'brick');window(.93,yy-.03,5.28,.5,.48);roof(.3,yy-.08,5.95,1.25,.96,.45,'slate')
    box(3.5,3.2,4.8,.55,.65,1.65,'brick');box(3.43,3.13,6.45,.69,.79,.13,'ivory')
    for xx in [-3.6,4.68]:beam((xx,-1.74,.25),(xx,-1.74,4),.035,'copper')
    # The apron tells the story without toy vehicles: hose reel, hydrant,
    # bollards and one open utility locker, scaled as part of the building.
    for x in [-3.55,-1.05,1.75,4.65]:cyl(x,-2.05,.2,.065,.6,'yellow',12)
    cyl(-4.75,-3.8,.2,.11,.43,'red');cyl(-4.75,-3.8,.63,.14,.07,'red')
    beam((-4.97,-3.8,.46),(-4.53,-3.8,.46),.055,'red')
    planter(-5.3,-5.25,1.25,.6,True);tree(5.12,4.9,size=.85,seed=2);lamp(-5.15,-2.1)


def police():
    base();paving(-5.65,-5.65,11.3,3.55);paving(-5.65,-2.1,1.25,7.7)
    # Restrained Art Deco precinct: limestone ribs, blue glazed center and
    # a stepped civic crown, deliberately unlike the red-brick firehouse.
    building(-4.7,-1.55,.2,3,5.6,3.4,'ivory',floors=2,pitched=False)
    building(1.7,-1.55,.2,3,5.6,3.4,'ivory',floors=2,pitched=False)
    box(-1.7,-2.2,.2,3.4,6.25,4.65,'blue')
    for x in [-1.68,-1.15,1.05,1.58]:box(x,-2.3,.2,.12,6.48,4.8,'cream')
    for x in [-.73,0,.73]:
        box(x-.28,-2.34,.7,.56,.06,3.15,'glass')
        for z in [1.4,2.1,2.8,3.5]:box(x-.28,-2.38,z,.56,.04,.035,'gold')
    for i in range(3):box(-1.8+i*.24,-2.25+i*.24,4.85+i*.26,3.6-i*.48,6.4-i*.48,.25,'ivory')
    door(0,-2.43,.2,1.05,1.72);box(-1.3,-2.8,2.0,2.6,.65,.12,'blue')
    text('POLICE',0,-2.87,2.34,.36,'cream')
    # Cast bronze shield on the entrance crown, rather than a rooftop decal.
    verts=[(-.43,-2.365,4.1),(.43,-2.365,4.1),(.37,-2.365,3.72),(0,-2.365,3.45),(-.37,-2.365,3.72)]
    mesh('precinct shield',verts,[(0,1,2,3,4)],'gold');text('★',0,-2.38,3.87,.29,'blue')
    for x in [-4.65,-3.7,-2.75,1.75,2.7,3.65,4.6]:box(x,-1.65,.2,.09,.12,3.4,'cream')
    for x in [-3.6,2.25]:planter(x,-3.9,1.35,.7,True)
    bench(-3.25,-5.2);bench(3.3,-5.2);lamp(-1.9,-3.25);lamp(1.9,-3.25)
    for x in [-5.15,5.15]:tree(x,4.8,size=.95,seed=int(x*10))
    # Compact rooftop aerial is a functional accent, not the main silhouette.
    beam((3.5,2.7,3.8),(3.5,2.7,5.1),.025,'steel')
    for z in [4.65,4.9]:beam((3.15,2.7,z),(3.85,2.7,z),.018,'steel')


def hospital():
    base();paving(-5.65,-5.65,11.3,3.2);paving(-5.65,-2.45,1.25,8.05)
    # A modern healing garden: curved sunlit ward above a lower clinic,
    # terracotta sunshades, glass stairwell, and a sheltered emergency entry.
    building(-4.6,-1.75,.2,9.2,5.8,1.85,'white',floors=1,pitched=False)
    box(-3.0,-.6,2.35,5.8,4.45,4.0,'white',.16)
    for z in [2.65,3.95,5.25]:
        for x in [-2.6,-1.75,-.9,-.05,.8,1.65]:window(x,-.64,z,.65,.78,lit=int((x+3)*10)%3==0)
        for yy in [.05,1.15,2.25,3.35]:window(2.82,yy,z,.7,.8,side='right')
        box(-3.14,-.83,z+1.02,6.1,4.75,.095,'teal')
    box(-3.2,-.85,6.35,6.2,4.85,.16,'white')
    # Four-sided raised medical beacon, integrated into the roof plant room.
    box(-.7,1.0,6.51,1.4,1.25,.8,'teal')
    for yy in [.96,2.28]:
        box(-.12,yy,6.64,.24,.035,.53,'white');box(-.35,yy,6.80,.7,.035,.2,'white')
    # Teal-glass circulation drum brings a contrasting rounded volume.
    cyl(3.8,.55,2.25,.78,3.55,'glass',32)
    for z in [2.3,3.45,4.6,5.8]:cyl(3.8,.55,z,.81,.075,'white',32)
    cyl(3.8,.55,5.88,.9,.14,'white',32)
    door(0,-1.85,.2,1.5,1.55,'teal')
    box(-2.1,-3.3,1.85,4.2,1.55,.13,'white',.06)
    box(-2.08,-3.32,1.66,4.16,.08,.2,'red');text('EMERGENCY',0,-3.38,1.76,.23,'white')
    for x in [-1.9,1.9]:cyl(x,-3.1,.2,.045,1.65,'steel')
    for x in [-4.8,3.3]:planter(x,-4.95,1.6,.8,True)
    bench(-3.95,-3.8);bench(4,-3.8);tree(-5.15,4.8,size=1.05,seed=4);tree(5.1,4.8,size=1,seed=3)
    for x in [-2.7,2.7]:lamp(x,-4.6,1.3)


def school():
    base();paving(-5.65,-5.65,11.3,1.15);paving(-.65,-4.5,1.3,5.8)
    # Welcoming red-brick schoolhouse, steep tiled wings and central bell cupola.
    building(-4.7,.0,.2,3.4,4.6,2.35,'bricklight',floors=1,roofmat='clay')
    building(1.3,.0,.2,3.4,4.6,2.35,'bricklight',floors=1,roofmat='clay')
    building(-1.3,-.65,.2,2.6,5.3,3.45,'ivory',floors=2,roofmat='clay')
    door(0,-.8,.2,1.05,1.7,'teal');text('SCHOOL',0,-.8,2.2,.27,'blue')
    box(-.6,1.2,4.6,1.2,1.2,.28,'cream')
    for x in [-.5,.5]:
        for y in [1.3,2.3]:box(x-.04,y-.04,4.88,.08,.08,.75,'cream')
    cyl(0,1.8,5.15,.18,.26,'gold',16,r2=.28);hip(-.72,1.08,5.7,1.44,1.44,.75,'copper')
    clock(0,-.78,3.1,.29)
    # One small playground, rather than an obligatory vehicle on the apron.
    paving(-5.1,-4.15,3.4,3.45,'path')
    for x in [-4.7,-2.4]:
        beam((x,-3.6,.2),(x,-2.95,1.8),.055,'wood');beam((x,-2.3,.2),(x,-2.95,1.8),.055,'wood')
    beam((-4.7,-2.95,1.8),(-2.4,-2.95,1.8),.06,'teal')
    for x in [-4,-3.05]:
        for dx in [-.2,.2]:beam((x+dx,-2.95,1.77),(x+dx,-2.95,.55),.014,'steel')
        box(x-.25,-3.12,.5,.5,.34,.05,'red')
    # Raised beds and outdoor learning circle balance the play area.
    for y in [-3.8,-2.3]:planter(2.2,y,2.5,.65,True)
    tree(4.8,-.8,size=1.1,seed=5);tree(-5.1,4.9,size=.9,seed=8)
    bench(3.3,-4.6);lamp(-1,-4.9,1.5)


def jail():
    base();paving(-5.6,-5.6,11.2,11.2,'paving')
    # Compact county jail: a robust entrance lodge and secure exercise garden.
    building(-4.9,1.1,.2,9.3,3.8,3.6,'ivory',floors=2,roofmat='slate')
    building(-4.9,-3.5,.2,2.5,4.6,2.3,'brick',floors=1,roofmat='slate')
    door(-3.65,-3.62,.2,.9,1.6);text('COUNTY JAIL',-3.65,-3.69,2.02,.19,'cream')
    for x in [-4,-2.8,-1.6,-.4,.8,2,3.2]:
        for z in [.7,2.15]:
            for dx in [-.14,0,.14]:beam((x+dx,1.0,z),(x+dx,1.0,z+.85),.02,'steel')
    paving(-1.7,-3.9,5.5,4.1,'asphalt',z=.215)
    for x in [-1.45,3.55]:fence(x,-4.1,0,5.1,1.65)
    fence(-1.45,-4.1,5,0,1.65)
    for x in [-1.45,3.55]:
        cyl(x,-4.1,.2,.13,2.25,'ivory');box(x-.21,-4.31,2.45,.42,.42,.12,'slate')
    for y in [-3.4,-.2]:box(-.65,y,.26,3.3,.025,.008,'white',0)
    for x in [-.65,2.65]:box(x,-3.4,.26,.025,3.2,.008,'white',0)
    bench(1,-.6);planter(-5.1,-5.25,2.7,.55);tree(4.9,4.9,size=.8,seed=9)
