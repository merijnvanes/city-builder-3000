"""Four domestic families on one-tile lots, growing from cottages to villas."""
from common import *


def home(level,variant):
    base(4)
    wall=['cream','bricklight','ivory','white'][variant]
    x=-1.45;y=-.65;w=1.8+level*.08;d=1.55+level*.12
    floors=1 if level<3 else 2;h=1.25 if floors==1 else 2.3
    box(x-.05,y-.05,.2,w+.1,d+.1,.12,'ivory')
    box(x,y,.32,w,d,h-.12,wall)
    windows(x,y,.2,w,d,h,floors=floors)
    box(x-.045,y-.045,h+.12,w+.09,d+.09,.08,'ivory')
    if variant==3:
        box(x-.08,y-.08,h+.2,w+.16,d+.16,.13,'slate')
        box(x+.13,y+.13,h+.33,w-.26,d-.26,.06,'grass')
        for xx in [x-.04,x+w-.04]:box(xx,y-.04,h+.33,.08,d+.08,.12,'slate')
        for yy in [y-.04,y+d-.04]:box(x-.04,yy,h+.33,w+.08,.08,.12,'slate')
        # A projecting timber entry screen distinguishes the flat-roof family.
        for dx in [0,.15,.3]:box(x+.1+dx,y-.25,.2,.045,.12,1.2,'wood')
    elif variant==1:
        hip(x-.1,y-.1,h+.2,w+.2,d+.2,.6,'clay')
    else:
        roof(x-.1,y-.1,h+.2,w+.2,d+.2,.65 if variant==0 else .9,'slate' if variant==0 else 'clay')
        box(x+.25,y+.8,h+.25,.22,.27,.9,'brick')
        box(x+.22,y+.77,h+1.15,.28,.33,.08,'ivory')
    door(-.25,y,.2,w=.5,h=.98,mat='wood')
    box(.5,y-.13,1.01,.12,.08,.2,'slate')
    box(.525,y-.16,1.05,.07,.035,.12,'lamp')
    paving(-.58,-1.95,.66,1.3,'path')
    if variant==2:
        box(x-.05,y-.45,.2,w+.1,.45,.09,'wood')
        for xx in [x+.05,x+w-.05]:box(xx,y-.4,.29,.055,.055,.82,'ivory')
        roof(x-.12,y-.52,1.11,w+.24,.57,.3,'slate')
    if level>=2:
        gx=x+w+.12
        box(gx,-.18,.2,.62,1.2,.95,'ivory')
        if variant==3:box(gx-.04,-.22,1.15,.7,1.28,.08,'slate')
        else:roof(gx-.04,-.22,1.15,.7,1.28,.25,'slate')
        box(gx+.045,-.205,.2,.53,.025,.78,'wood')
        for z in [.4,.6,.8]:box(gx+.05,-.225,z,.52,.015,.02,'steel')
        paving(gx,-1.95,.62,1.74,'asphalt')
    if level==4:
        box(-1.75,-1.87,.17,.93,.73,.09,'ivory')
        box(-1.67,-1.79,.265,.77,.57,.015,'water')
    else:
        planter(-1.7,-1.75,.55,.5,flowers=True)
    tree(1.45,1.45,size=.24,seed=variant)
    for xx,ww in [(-1.88,1.15),(.22,.45)]:fence(xx,-1.9,ww,0,.38)
    fence(-1.88,1.86,3.76,0,.38)
