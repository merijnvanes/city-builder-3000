"""Business skyline: glass shafts and three signature crowns."""
from common import *


def glass_block(x,y,z,w,d,h,floors,wall):
    # Continuous curtain walls, with fine mullions instead of house window frames.
    box(x,y,z,w,d,h,wall)
    step=h/floors
    if 'officewindowlit' not in M:
        m=material('officewindowlit',(.22,.35,.37),rough=.23,metal=.2,emission=.65)
        m.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.85,.62,.35,1)
    for axis,length in [('front',w),('back',w),('left',d),('right',d)]:
        count=max(2,round(length/.55))
        for i in range(count):
            along=(i+.02)*length/count;span=length/count-.025
            for floor in range(floors):
                zz=z+floor*step+.035
                if random.Random((i+1)*92821+(floor+1)*68917+['front','back','left','right'].index(axis)*13613).random()>=.22:continue
                if axis in ['front','back']:
                    box(x+along,y-.018 if axis=='front' else y+d,zz,span,.018,step-.065,'officewindowlit',0)
                else:box(x-.018 if axis=='left' else x+w,y+along,zz,.018,span,step-.065,'officewindowlit',0)
        for i in range(count+1):
            along=i*length/count
            if axis in ['front','back']:box(x+along-.012,y-.026 if axis=='front' else y+d, z,.024,.026,h,'silver',0)
            else:box(x-.026 if axis=='left' else x+w,y+along-.012,z,.026,.024,h,'silver',0)
    for floor in range(floors+1):box(x-.03,y-.03,z+floor*step,w+.06,d+.06,.035,'silver',0)
    box(x+.04,y+.04,z+h+.04,w-.08,d-.08,.065,'slate')


def tower(size,level,variant):
    s=size*4;half=s/2;style=variant%3;signature=variant>=3
    base(s,'paving');floors=5+level*3;h=floors*.8
    pw=s-.65;py=-half+.55
    building(-pw/2,py,.2,pw,s-1.05,1.0,'ivory',floors=1,pitched=False)
    door(0,py,.2,min(1.2,s*.2),.95)
    z=1.2
    if signature and style in [0,2]:
        glass='ivory' if style==0 else 'glasslight'
        for tier in range(3):
            w=s*(.74-tier*.15);d=s*(.67-tier*.13);rise=h*[.48,.32,.2][tier]
            tier_floors=max(2,round(floors*[.48,.32,.2][tier]))
            if style==0:building(-w/2,-d/2,z,w,d,rise,glass,floors=tier_floors,pitched=False)
            else:glass_block(-w/2,-d/2,z,w,d,rise,tier_floors,glass)
            if style==0:
                for xx in [-w/2+.08,w/2-.13]:box(xx,-d/2-.065,z,.05,.1,rise,'cream')
            else:
                box(-w/2+.08,d/2-.25,z+rise+.17,w-.16,.17,.18,'hedge')
                box(w/2-.25,-d/2+.08,z+rise+.17,.17,d-.4,.18,'hedge')
            z+=rise
        if style==0:
            hip(-w/2-.04,-d/2-.04,z+.32,w+.08,d+.08,.75,'copper')
            cyl(0,0,z+1.07,.025,.8+level*.15,'silver',10)
        else:box(-.3,-.25,z+.35,.6,.5,.3,'steel')
    else:
        w=s*(.5 if style==1 else .64);d=s*(.49 if style==2 else .6)
        glass=['glasslight','glass','teal'][style]
        glass_block(-w/2,-d/2,z,w,d,h,floors,glass)
        for i in range(1,floors):box(-w/2-.025,-d/2-.025,z+i*.8,w+.05,d+.05,.04,'silver')
        if signature:
            for xx in [-w/2,w/2-.045]:
                for yy in [-d/2,d/2-.045]:box(xx,yy,z,.045,.045,h+.75,'ivory')
            box(-w*.43,-d*.43,z+h+.32,w*.86,d*.86,.55,'glasslight')
            box(-w*.27,-d*.24,z+h+.87,w*.54,d*.48,.45,'slate')
        elif style==1:
            box(-w*.38,-d*.38,z+h+.32,w*.76,d*.76,.75,glass)
            box(-.2,-.2,z+h+1.07,.4,.4,.5,'ivory')
            if level==4:cyl(0,0,z+h+1.57,.025,1.5,'silver',10)
        elif style==2:
            roof(-w*.44,-d*.44,z+h+.32,w*.88,d*.88,.8,'copper')
        else:
            box(-.3,-.3,z+h+.32,.6,.6,.4,'steel')
            if level==4:cyl(0,0,z+h+.72,.025,1.5,'silver',10)
    # Planting remains on exposed podium corners, not under the tower shell.
    for xx,yy in [(-half+.48,half-.62),(half-.68,-half+.72)]:
        box(xx,yy,1.35,.23,.23,.13,'ivory')
        box(xx+.03,yy+.03,1.48,.17,.17,.18,'hedge')
