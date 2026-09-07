"""Residential tower families: podiums, setbacks and generous balcony stacks."""
from common import *
from zone_apartments import balconies


def tower(size,level,variant):
    s=size*4;half=s/2;style=variant%3
    base(s,'paving')
    wall=['ivory','bricklight','cream','glasslight','brick'][variant]
    floors=4+level*2;h=floors*.85
    margin=.35;pw=s-.7
    building(-half+margin,-half+margin,.2,pw,pw,.85,'bricklight' if variant<3 else 'teal',floors=1,pitched=False)
    # A street-facing lobby and small planting pockets make the podium inhabited.
    door(0,-half+margin,.2,w=.7 if size==1 else 1.2,h=.85)
    if style==1 and size>=2:
        for i,(fraction,portion) in enumerate([(.82,.43),(.63,.34),(.4,.28)]):
            w=s*fraction;z=1.05+[0,h*.43,h*.77][i]
            building(-w/2,-w/2,z,w,w,h*portion,wall if i<2 else 'glasslight',floors=max(2,round(floors*portion)),pitched=False)
        cyl(0,0,1.05+h*1.05+.15,.035,.7,'silver',10)
    elif style==2:
        w=s*.78;d=s*.5;y=-s*.2
        building(-w/2,y,1.05,w,d,h+.65,wall,floors=floors+1,pitched=False)
        balconies(-w/2+.08,y,w-.16,floors+1)
        box(-.3,.3,1.8+h,.6,.55,.35,'steel')
    else:
        twin=size==3 and level==4
        w=s*(.31 if twin else .55);d=s*.57
        for i,x in enumerate([-s*.35,s*.045] if twin else [-w/2]):
            height=h-(.85 if i else 0)
            building(x,-d/2,1.05,w,d,height,wall if i==0 else 'cream',floors=floors-i,pitched=False)
            for z in range(2,floors,2):box(x-.04,-d/2-.04,1.05+z*.85,w+.08,d+.08,.065,'ivory')
            box(x+w*.3,.15,1.22+height,w*.35,.5,.3,'steel')
    for x,y in [(-half+.45,half-.45),(half-.45,-half+.65)]:
        # Small roof planters stay on the podium, clear of the tower footprint.
        before=set(bpy.context.scene.objects)
        planter(x-.18,y-.18,.36,.36)
        for obj in set(bpy.context.scene.objects)-before:obj.location.z+=1.1
