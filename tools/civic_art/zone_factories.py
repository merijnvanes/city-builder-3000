"""Workshops and process yards with loading doors, sawtooth roofs and storage."""
from common import *

PALETTES=['bricklight','blue','gold','teal','purple']
BREAKS=[0,.2,1/3,.4,.6,2/3,.8,1]

def container(x,y,w,d,h,accent):
    box(x,y,.2,w,d,h,accent)
    for i in range(1,7):box(x+i*w/7,y-.022,.23,.02,.025,h-.06,'silver',0)
    box(x-.02,y-.02,h+.2,w+.04,d+.04,.035,'steel')


def factory_windows(x,y,w,d,h):
    rows=max(1,round(h/1.3));step=h/rows
    for side,length in [('front',w),('back',w),('left',d),('right',d)]:
        count=max(1,round(length/1.3));span=length/count*.6
        for i in range(count):
            along=(i+.5)*length/count-span/2
            for row in range(rows):
                zz=.2+row*step+step*.4;wh=step*.43
                lit=(i+row+(1 if side in ['back','left'] else 0))%3==0 or (count==1 and row==0)
                # Metal-framed factory glazing; no domestic sill or pediment.
                before=set(bpy.context.scene.objects)
                box(-span/2,-.035,zz,span,.035,wh,'windowlit' if lit else 'glasslight',0)
                for xx in [-span/2,-.012,span/2-.025]:box(xx,-.065,zz,.025,.03,wh,'steel',0)
                for z in [zz,zz+wh*.5,zz+wh-.025]:box(-span/2,-.065,z,span,.03,.025,'steel',0)
                center=along+span/2
                angle={'front':0,'right':math.pi/2,'back':math.pi,'left':-math.pi/2}[side]
                origin={'front':(x+center,y),'back':(x+length-center,y+d),'left':(x,y+length-center),'right':(x+w,y+center)}[side]
                for obj in set(bpy.context.scene.objects)-before:
                    xx,yy=obj.location.x,obj.location.y
                    obj.location.x=origin[0]+xx*math.cos(angle)-yy*math.sin(angle)
                    obj.location.y=origin[1]+xx*math.sin(angle)+yy*math.cos(angle)
                    obj.rotation_euler.z+=angle


def sawroof(x,y,z,w,d,rise):
    ridge=x+w*.78
    vertices=[(x,y,z),(x+w,y,z),(x+w,y+d,z),(x,y+d,z),(ridge,y,z+rise),(ridge,y+d,z+rise)]
    mesh('sawtooth opaque pitch',vertices,[(0,4,5,3),(0,1,4),(3,5,2),(0,3,2,1)],'steel')
    mesh('northlight glazing',vertices,[(4,1,2,5)],'glasslight')
    for yy in [y,y+d]:
        beam((x,yy,z),(ridge,yy,z+rise),.025,'silver')
        beam((ridge,yy,z+rise),(x+w,yy,z),.025,'silver')
    beam((ridge,y,z+rise),(ridge,y+d,z+rise),.03,'silver')


def shed(x,y,w,d,h,wall,warehouse=False):
    box(x,y,.2,w,d,h,wall)
    factory_windows(x,y,w,d,h)
    if warehouse:
        box(x-.05,y-.05,h+.2,w+.1,d+.1,.1,'slate')
        for yy in [y+d*.25,y+d*.6]:box(x+w*.15,yy,h+.31,w*.7,d*.12,.045,'glasslight')
    else:
        for i in range(3):sawroof(x+i*w/3,y,h+.2,w/3,d,.3 if w<3 else .55)
    for xx in [x+w*.2,x+w*.64]:
        box(xx,y-.05,.2,w*.17,.06,min(1.1,h*.8),'slate')
        for z in [.4,.6,.8]:box(xx,y-.09,z,w*.17,.025,.025,'silver',0)
        box(xx,y-.1,min(1.1,h*.8)+.2,w*.17,.04,.055,'lamp')


def workshop(level,variant):
    base(4,'paving');accent=PALETTES[variant]
    paving(-1.85,-1.85,3.7,1.3,'asphalt')
    shed(-1.65,-.25,3.3,1.85,1.05+level*.1,accent)
    container(-1.5,-1.45,1.05,.55,.4,'wood')
    container(.15,-1.4,.9,.5,.4+.05*level,PALETTES[(variant+1)%5])
    if level>=3:cyl(1.5,-.85,.2,.21,.75,'silver',16)
    if level==4:box(-1.2,.6,1.95,.65,.55,.23,'slate')
    # Empty approach at x=-.15 connects loading apron to both shutter bays.


def factory(size,level,variant,density):
    s=size*4;half=s/2;heavy=density==3
    seed=(BREAKS[variant]+BREAKS[variant+1])/2 if not heavy else (variant+.5)/5
    palette=min(4,int(seed*5));warehouse=not heavy and int(seed*3)==1
    base(s,'paving');accent=PALETTES[palette]
    paving(-half+.15,-half+.15,s-.3,s*.32,'asphalt')
    x=-half+.35;y=-s*.07;w=s*(.51 if heavy else .82);d=s*.46;h=1.25+level*.15 if warehouse else 1.4+level*.23
    shed(x,y,w,d,h,'steel' if warehouse else 'bricklight',warehouse)
    if not warehouse:
        for i in range(3 if heavy else 2):
            xx=x+w*(.2+i*(.3 if heavy else .6));yy=y+d*.65
            rise=1.9+level*.18+i*.3
            cyl(xx,yy,h+.2,.075 if size==1 else .12,rise,'ivory',12)
            cyl(xx,yy,h+rise-.2,.08 if size==1 else .125,.25,'bricklight',12)
            cyl(xx,yy,h+rise+.2,.06 if size==1 else .1,.035,'dark',12)
    if heavy:
        xx=half-s*.18
        for yy,rise in [(s*.07,1.4+level*.15),(s*.33,1.7+level*.17)]:
            radius=s*.087
            cyl(xx,yy,.2,radius,rise,'silver',24)
            cyl(xx,yy,rise+.2,radius*1.025,.075,'ivory',24)
            cyl(xx,yy,rise+.275,radius*.8,.04,'steel',24)
        beam((x+w,y+d*.4,1.1),(xx,s*.07,1.1),.04,'steel')
    for i in range(2):
        xx=-half+s*(.1+i*.31);yy=-half+s*.15
        container(xx,yy,s*.23,s*.11,.35+level*.06+i*.08,PALETTES[(palette+i)%5])
    for i in range(4):box(-half+s*(.15+i*.21),-half+.26,.205,s*.08,.025,.015,'gold',0)
