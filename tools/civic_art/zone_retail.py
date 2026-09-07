"""Street shops, diners and filling stations with open forecourts."""
from common import *

ACCENTS=['bricklight','red','teal','purple','blue']

def storefront(x,y,z,w,h,accent):
    box(x,y-.045,z,w,.055,h,'glasslight')
    for xx in [x,x+w/2,x+w]:box(xx-.025,y-.09,z,.05,.07,h,'ivory')
    box(x-.06,y-.3,z+h,w+.12,.33,.13,accent)
    box(x+w*.15,y-.12,z+h-.08,w*.7,.04,.045,'lamp')


def retail(level,variant):
    base(4,'paving');style=variant%3;accent=ACCENTS[variant]
    paving(-1.85,-1.85,3.7,1.35,'asphalt')
    # Parking is beside a clear central pedestrian approach, with no toy cars.
    for x in [-1.7,-.85,.85,1.7]:box(x,-1.8,.195,.025,.85,.012,'white')
    if style==2 and level<=2:
        building(-1.65,.75,.2,2.15,.9,1.1,'cream',floors=1,pitched=False)
        storefront(-1.4,.75,.35,1.15,.65,accent);door(.1,.75,.2,.45,.9)
        for x in [-1.4,1.4]:cyl(x,-.6,.2,.045,1.55,'silver')
        box(-1.6,-1.25,1.75,3.2,1.85,.15,accent)
        box(-1.5,-1.15,1.9,3,1.65,.05,'white')
        box(-1.2,-.9,1.72,2.4,.08,.04,'lamp')
        for x in [-.7,.7]:
            box(x-.17,-.55,.2,.34,.4,.62,accent)
            box(x-.13,-.59,.58,.26,.035,.16,'dark')
            beam((x+.2,-.4,.72),(x+.25,-.5,.3),.02,'slate')
        if level==2:box(.85,.8,.2,.6,.7,.45,'steel')
    elif style==1:
        h=1.1+level*.1
        building(-1.55,-.1,.2,2.7,1.7,h,'white',floors=1,pitched=False)
        cyl(1.05,.75,.2,.65,h,'silver',24)
        cyl(1.05,.75,h+.2,.7,.12,accent,24)
        storefront(-1.35,-.1,.35,2.15,.67,accent)
        door(0,-.1,.2,.48,.95)
        for z in [.35,.6,.85]:box(-1.55,-.17,z,2.7,.04,.035,'silver')
        box(-1.6,-.15,h+.2,2.8,1.8,.13,accent)
        for x in [-.5,.5]:beam((x,.65,h+.33),(x,.65,h+.85),.025,'steel')
        box(-.85,.6,h+.65,1.7,.12,.5,accent)
        text('DINER',0,.57,h+.89,.27,'lamp')
        if level>=3:
            box(1.37,-.75,.2,.38,.5,.45,'teal')
            box(1.39,-.78,.58,.34,.04,.08,'lamp')
    else:
        h=1.05+level*.22
        building(-1.65,-.1,.2,3.3,1.75,h,'cream' if variant<3 else 'bricklight',floors=1,pitched=False)
        storefront(-1.43,-.1,.35,2.86,.75,accent)
        door(0,-.1,.2,.5,1.05)
        box(-1.45,-.14,h-.02,2.9,.15,.28,accent)
        text('MARKET' if variant==0 else 'SHOPS',0,-.23,h+.12,.2,'lamp')
        box(.65,.65,h+.36,.55,.55,.25,'steel')
        if level>=3:
            box(-1.25,.35,h+.35,1.1,.95,.5,'ivory')
            box(-1.3,.3,h+.85,1.2,1.05,.08,'slate')
    if not(style==2 and level<=2):
        paving(-.3,-1.92,.6,1.8,'path',z=.21)
        planter(-1.85,-.45,.4,.3)
