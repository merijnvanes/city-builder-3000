from common import *

def college():
    base(16);paving(-7.65,-7.65,15.3,2.0);paving(-.85,-5.65,1.7,11.8)
    # Collegiate Gothic quadrangle: long tiled halls, an asymmetrical clock
    # tower, cloister walks and an actual inhabited garden at its heart.
    building(-6.8,-3.8,.2,3.05,10.6,3.7,'brick',floors=2,roofmat='slate')
    building(3.75,-3.8,.2,3.05,10.6,3.7,'brick',floors=2,roofmat='slate')
    building(-3.75,3.75,.2,7.5,3.05,4.0,'ivory',floors=2,roofmat='copper')
    for x in [-3.5,2.75]:
        paving(x,-3.6,.75,7.4)
        for y in [-3,-1.65,-.3,1.05,2.4]:
            cyl(x+.35,y,.2,.085,2.05,'ivory',12)
            beam((x+.35,y,2.25),(x+.35,y+1.35,2.25),.07,'ivory')
        box(x-.1,-3.65,2.25,.95,7.5,.12,'copper')
    # Corner clock tower, buttressed shaft and a patinated spire.
    building(-6.9,-4.8,.2,3.3,3.3,7.2,'ivory',floors=3,pitched=False)
    for x in [-6.98,-3.87]:
        for y in [-4.88,-1.77]:box(x,y,.2,.27,.27,7.5,'cream')
    for y in [-4.93,-1.42]:
        clock(-5.25,y,6.42,.58)
    box(-7.07,-4.97,7.6,3.64,3.64,.22,'cream');hip(-7.18,-5.08,7.82,3.86,3.86,1.9,'copper')
    cyl(-5.25,-3.15,9.72,.045,.65,'gold')
    # A formal entrance arch at the opposite end remains lower than the quad.
    for x in [-1.5,1.25]:
        box(x,-5.25,.2,.25,.5,2.1,'ivory');hip(x-.1,-5.35,2.3,.45,.7,.32,'copper')
    beam((-1.25,-5,2),(1.25,-5,2),.045,'slate');text('COLLEGE',0,-5.1,2.03,.22,'gold')
    door(0,3.63,.2,1.1,1.85,'copper')
    for x in [-2.25,2.25]:
        for y in [-2.5,1.8]:tree(x,y,size=.85,seed=int(abs(x*y)*10))
    cyl(0,.7,.2,.72,.24,'ivory',24);cyl(0,.7,.44,.6,.045,'water',24)
    cyl(0,.7,.48,.085,.65,'ivory');cyl(0,.7,1.13,.3,.09,'ivory',24)
    bench(-1.85,-3.85);bench(1.85,-3.85);lamp(-.95,-6.6);lamp(.95,-6.6)
    for x in [-7.15,5.7]:planter(x,-6.95,1.5,.6,True)
    # Ivy patches soften one wing, without repeating them across every facade.
    for j in range(7):ball(6.86,-2.7+j*.39,.7+j*.27,.32,'hedge',scale=(.2,1,1.35))


def library():
    base(8);paving(-3.65,-3.65,7.3,2.3)
    # A contemporary neighborhood library: a copper barrel-vault reading room
    # joins a warm timber archive wing. The roof itself provides the identity.
    building(-3.1,-.8,.2,2.2,3.9,2.35,'ivory',floors=1,pitched=False)
    box(-.75,-1.15,.2,3.8,4.25,2.35,'wood')
    # Recessed glazed front and back, evenly spaced timber mullions.
    for y in [-1.18,3.11]:
        box(-.57,y,.43,3.43,.04,2.0,'glass')
        for x in [-.5,.15,.8,1.45,2.1,2.75]:box(x,y-.035,.4,.075,.1,2.12,'ivory')
        box(-.58,y-.05,1.42,3.45,.12,.06,'ivory')
    # Semi-elliptical copper shell, ribs and clerestory glass in the ends.
    x,y,z,w,d,rise=-.95,-1.35,2.55,4.2,4.7,1.55
    verts=[];segments=24
    for yy in [y,y+d]:
        for i in range(segments+1):
            a=math.pi*i/segments;verts.append((x+w/2+math.cos(a)*w/2,yy,z+math.sin(a)*rise))
    mesh('vaulted copper roof',verts,[(i,i+1,segments+2+i,segments+1+i) for i in range(segments)],'copper')
    for yy in [y+.04,y+d-.04]:
        mesh('vault end glazing',[(x,yy,z),(x+w,yy,z)]+[(x+w/2+math.cos(math.pi*i/segments)*w/2,yy,z+math.sin(math.pi*i/segments)*rise) for i in range(segments+1)], [tuple(range(segments+3))],'glasslight')
        for i in range(segments):beam((verts[i][0],yy,verts[i][2]),(verts[i+1][0],yy,verts[i+1][2]),.035,'cream')
    for yy in [-1.3,-.35,.6,1.55,2.5,3.3]:
        for i in range(segments):beam((verts[i][0],yy,verts[i][2]+.012),(verts[i+1][0],yy,verts[i+1][2]+.012),.013,'copper')
    door(-1.95,-.92,.2,.85,1.65,'copper');text('LIBRARY',-1.95,-1.0,2.19,.22,'blue')
    # Shelves are visible through the side bay as broad bands of warm color.
    for z in [.7,1.18,1.66]:
        box(2.91,-.65,z,.08,3.05,.08,'ivory')
        for i in range(14):box(2.95,-.55+i*.2,z+.08,.09,.10,.3,['red','gold','copper','ivory'][i%4])
    for yy in [-.55,.4,1.35,2.3]:window(3.075,yy,.6,.7,1.52,side='right')
    bench(1.3,-2.75);planter(-3.35,-3.25,1.6,.6,True);tree(3.3,3.2,size=.68,seed=15);lamp(-.5,-3.1,1.35)
    # Bike hoops are optional context at a walkable public building.
    for x in [-.2,.25,.7]:
        beam((x,-2.2,.2),(x,-2.2,.55),.019,'steel');beam((x,-2.2,.55),(x,-1.9,.55),.019,'steel');beam((x,-1.9,.55),(x,-1.9,.2),.019,'steel')


def museum():
    base();paving(-5.65,-5.65,11.3,4.3)
    # A limestone museum with a copper rotunda, sculpted pediment and a broad
    # colonnade. Ornament concentrates at the entry, not on every surface.
    building(-4.7,-.8,.2,9.4,5.4,3.0,'ivory',floors=1,pitched=False)
    cyl(0,1.7,3.45,2.0,.55,'cream',32)
    dome(0,1.7,4,2.0,1.65,'copper')
    cyl(0,1.7,5.65,.19,.3,'ivory',16);dome(0,1.7,5.95,.23,.3,'gold')
    # Structural plinth and authentic layered column capitals.
    box(-3.8,-2.5,.2,7.6,1.72,.38,'ivory')
    for x in [-3.3,-2,-.67,.67,2,3.3]:
        box(x-.21,-2.16,.58,.42,.42,.11,'cream')
        cyl(x,-1.95,.69,.15,2.12,'cream',20,r2=.12)
        cyl(x,-1.95,2.81,.22,.14,'cream',16)
        box(x-.24,-2.19,2.95,.48,.48,.15,'cream')
        for j in range(8):
            a=j*math.tau/8;beam((x+math.cos(a)*.146,-1.95+math.sin(a)*.146,.85),(x+math.cos(a)*.125,-1.95+math.sin(a)*.125,2.68),.012,'ivory')
    box(-3.9,-2.55,3.1,7.8,1.85,.22,'cream')
    # Pediment ridge perpendicular to the colonnade.
    roof(-4,-2.65,3.32,8,2,1.2,'ivory')
    text('MUSEUM',0,-2.58,3.22,.27,'blue')
    # Pediment relief: a small raised rosette in stone.
    ball(0,-2.69,3.86,.23,'cream',scale=(1,.22,1));text('✦',0,-2.77,3.86,.35,'gold')
    for i in range(5):box(-3.95-i*.11,-2.76-i*.25,.16,7.9+i*.22,.25,.43-i*.075,'ivory')
    door(0,-.92,.58,1.3,2.15,'copper')
    for x in [-4.32,4.05]:box(x,-.96,1.2,.28,.09,1.8,'purple')
    # Two different artworks make the forecourt feel curated.
    for x in [-4.75,4.75]:box(x-.29,-4.8,.2,.58,.58,.55,'ivory')
    cyl(-4.75,-4.51,.75,.11,.65,'copper');ball(-4.75,-4.51,1.55,.23,'copper')
    for z,r in [(.85,.35),(1.2,.26),(1.55,.17)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.055,major_segments=20,minor_segments=8,location=(4.75,-4.51,z),rotation=(math.pi/2,.3,0));finish(bpy.context.object,'gold')
    tree(-5.1,4.8,size=.9,seed=17);tree(5.1,4.8,size=.85,seed=18);lamp(-3.3,-5.1);lamp(3.3,-5.1)
