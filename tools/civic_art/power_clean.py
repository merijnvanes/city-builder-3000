"""Cooling-tower nuclear campus and the two renewable generators."""
from power_common import *


def cooling_tower(x,y,r=1.85,h=5.8):
    # A hollow, waisted concrete shell; the dark throat has visible wall
    # thickness, not a capped cylinder pretending to be a cooling tower.
    profile=[(0,1),(.08,.96),(.3,.76),(.58,.66),(.8,.70),(1,.79)]
    seg=64;verts=[]
    for inner in [False,True]:
        for z,rr in profile:
            radius=r*rr-(.12 if inner else 0)
            for i in range(seg):
                a=i/seg*math.tau;verts.append((x+radius*math.cos(a),y+radius*math.sin(a),.8+z*h))
    rows=len(profile);offset=rows*seg;faces=[]
    for j in range(rows-1):
        for i in range(seg):
            a=j*seg+i;b=j*seg+(i+1)%seg
            faces.extend([(a,b,b+seg,a+seg),(offset+a+seg,offset+b+seg,offset+b,offset+a)])
    for i in range(seg):
        a=(rows-1)*seg+i;b=(rows-1)*seg+(i+1)%seg
        faces.append((a,b,offset+b,offset+a))
    shell=mesh('open hyperbolic cooling shell',verts,faces,'ivory')
    for p in shell.data.polygons:p.use_smooth=True
    cyl(x,y,.2,r+.2,.2,'ivory',48)
    cyl(x,y,.41,r-.12,.02,'dark',48)
    for i in range(16):
        a=i/16*math.tau
        beam((x+r*math.cos(a),y+r*math.sin(a),.4),(x+r*.99*math.cos(a+.08),y+r*.99*math.sin(a+.08),.88),.065,'ivory')
    ring(x,y,.8+h,r*.79-.055,.07,'cream')


def nuclear():
    yard()
    cooling_tower(-3.65,3.7,2.15,6.2)
    cooling_tower(2.1,4.0,1.95,5.5)
    # Domed containment is physically separate from the cooling circuit and
    # the long turbine hall. Broad pale masses read at city scale.
    cyl(-3.9,-2.05,.2,2.1,.3,'ivory',48)
    cyl(-3.9,-2.05,.5,1.94,2.5,'white',48)
    dome(-3.9,-2.05,3,1.94,1.75,'white')
    ring(-3.9,-2.05,2.98,1.94,.045,'silver')
    hall(-.8,-3.8,5.4,5.0,2.35,'teal','silver')
    for x in [-.1,1.6,3.3]:
        pipe([(x,1.0,1.0),(x,1.65,1.0),(x,1.65,.5)],.15,'silver')
    pipe([(-2.0,-2.1,1.35),(-1.35,-2.1,1.35),(-1.35,-1.2,1.35),(-.75,-1.2,1.35)],.24)
    control(-5.8,-6.8,3.5,1.6)
    for y in [-2.7,-.3,2.1]:transformer(6.0,y)
    lamp(.3,-6.1,1.8)


def wind():
    yard(1,grass=True)
    paving(-.48,-1.75,.96,1.9,'path')
    cyl(0,.15,.16,.57,.21,'ivory',32)
    cyl(0,.15,.37,.22,4.6,'white',32,r2=.12)
    # Sculpted nacelle and an actual three-blade rotor, with curved tapered
    # airfoils. The entire rotor fits the one-tile lot in every view.
    box(-.23,-.25,4.87,.46,.95,.34,'white',.1)
    hub=Vector((0,-.39,5.04))
    o=cyl(*hub,.19,.28,'white',32,r2=.10);o.rotation_euler.x=math.pi/2
    for angle in [0,math.tau/3,2*math.tau/3]:
        profile=[(.12,-.06),(.40,-.13),(.84,-.11),(1.32,-.035),(1.67,.04),(1.45,.095),(.78,.17),(.29,.12)]
        verts=[]
        for depth in [-.025,.025]:
            for radius,sweep in profile:
                verts.append((hub.x+radius*math.sin(angle)+sweep*math.cos(angle),hub.y+depth,hub.z+radius*math.cos(angle)-sweep*math.sin(angle)))
        n=len(profile)
        blade=mesh('tapered turbine airfoil',verts,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'white')
        bevel=blade.modifiers.new('soft blade leading edge','BEVEL');bevel.width=.02;bevel.segments=2
    box(.78,.55,.16,.58,.7,.65,'teal')
    box(.73,.5,.81,.68,.8,.07,'silver')
    for z in [.29,.4,.51,.62]:box(.80,.525,z,.5,.02,.028,'dark')
    box(-.08,-.077,.44,.16,.027,.35,'teal')
    material('turbine beacon',(.8,.045,.018),emission=2)
    ball(0,.3,5.27,.045,'turbine beacon')


def solar():
    yard(3,grass=True)
    paving(-5.45,-5.4,10.9,1.45,'path')
    # Four rows of tilted framed modules. Every surface and cell division is
    # authored in the panel's local plane, including the rear support legs.
    material('photovoltaic',(.016,.055,.15),rough=.28,metal=.25)
    tilt=math.radians(24)
    for y in [-3.2,-.85,1.5,3.85]:
        for x in [-3.85,-1.3,1.25,3.8]:
            before=set(bpy.context.scene.objects)
            box(x-1.11,y-.74,1.02,2.22,1.48,.075,'silver')
            box(x-1.04,y-.67,1.10,2.08,1.34,.015,'photovoltaic',0)
            for i in range(1,6):box(x-1.04+i*2.08/6,y-.67,1.12,.013,1.34,.004,'glasslight',0)
            for j in [1,2]:box(x-1.04,y-.67+j*1.34/3,1.12,2.08,.012,.004,'glasslight',0)
            for obj in set(bpy.context.scene.objects)-before:
                rel=obj.location-Vector((x,y,1.02));c,s=math.cos(tilt),math.sin(tilt)
                obj.location=(x+rel.x,y+rel.y*c-rel.z*s,1.02+rel.y*s+rel.z*c);obj.rotation_euler.x+=tilt
            for dx in [-.75,.75]:
                for dy in [-.52,.52]:
                    top=1.02+dy*math.sin(tilt)
                    beam((x+dx,y+dy*math.cos(tilt),.16),(x+dx,y+dy*math.cos(tilt),top),.035,'steel')
    for x in [-4.5,-3.5]:
        box(x,-5.1,.2,.65,.6,.85,'white')
        box(x+.09,-5.13,.41,.47,.025,.34,'teal')
    transformer(3.7,-4.75)
    lamp(-1.9,-4.8,1.25)
