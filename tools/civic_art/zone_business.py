"""Offices, hotels and department stores at neighborhood scale."""
from common import *
from zone_retail import storefront

PALETTES=['ivory','bricklight','cream','glasslight','cream','ivory','teal']

def business(size,level,variant):
    s=size*4;half=s/2;style=variant%3;wall=PALETTES[variant]
    base(s,'paving');x=-half+.35;y=-half+.95;w=s-.7;d=s-1.35
    floors=2+level;h=floors*.8
    if style==1:
        h+=.7
        building(x,y,.2,w,d,h,wall,floors=floors+1,pitched=False)
        for i in range(1,floors+1):box(x-.04,y-.04,.2+i*.8,w+.08,d+.08,.065,'ivory')
        canopy=min(2,w*.6)
        box(-canopy/2,y-.65,1.35,canopy,.7,.12,'red' if variant==1 else 'teal')
        for xx in [-canopy/2+.1,canopy/2-.1]:cyl(xx,y-.55,.2,.028,1.15,'silver')
        door(0,y,.2,.75,1.15)
        box(-w*.3,y+d*.55,h+.38,w*.6,.15,.55,'slate')
        text('HOTEL',0,y+d*.55-.035,h+.64,min(.4,w*.13),'lamp')
    elif style==2:
        h-=.5
        building(x,y,.2,w,d,h,wall,floors=floors,pitched=False)
        storefront(x+.18,y,.35,w-.36,1.15,'purple' if variant==5 else 'teal')
        door(0,y,.2,.85,1.3)
        for xx in [x+.1,x+w-.18]:box(xx,y-.07,.2,.08,.12,h,'ivory')
        box(-w*.22,y+d*.3,h+.4,w*.44,d*.4,.4,'steel')
        for i in range(3):box(-w*.2,y+d*.35+i*.15,h+.81,w*.4,.04,.03,'silver')
    else:
        building(x,y,.2,w,d,h,wall,floors=floors,pitched=False)
        for i in range(1,floors+1):box(x-.035,y-.035,.2+i*.8,w+.07,d+.07,.055,'ivory')
        storefront(-min(w*.3,1.2),y,.3,min(w*.6,2.4),1.05,'slate')
        door(0,y,.2,.75,1.15)
        box(x+.35,y+.4,h+.36,w*.35,d*.35,.35,'steel')
        if size>1:box(x+w*.65,y+d*.65,h+.36,w*.22,d*.2,.3,'silver')
    paving(-.45,-half+.08,.9,.9,'path')
    for xx in [-half+.45,half-.85]:planter(xx,-half+.25,.4 if size==1 else .7,.4,flowers=True)
    if size>1:
        bench(-2.1,-half+.5);bench(2.1,-half+.5)
