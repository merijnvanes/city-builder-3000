"""Passenger transport: open shelters, underground access and a railway hall."""
from common import *


def bus():
    base(4, 'paving')
    glass = material('shelterglass', (.38,.65,.67), rough=.16)
    glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value=.72
    # Back and sides enclose the seats, leaving a generous open boarding edge.
    for x in [-1.35, 1.15]:
        for y in [.15,1.16]: box(x, y, .2, .09, .09, 1.85, 'teal')
    box(-1.26, 1.16, .52, 2.41, .045, 1.35, 'shelterglass')
    for x in [-1.31, -.12, 1.1]: box(x, 1.13, .24, .055, .09, 1.8, 'teal')
    box(-1.29, .25, .52, .04, .91, 1.25, 'shelterglass')
    box(-1.47, .05, 2.08, 2.84, 1.35, .13, 'teal')
    box(-1.4, .1, 2.21, 2.7, 1.25, .045, 'silver')
    box(-1.1, .36, 2.055, 1.85, .075, .035, 'lamp')
    for y in [.025,1.405]: box(-1.3,y,2.12,2.5,.025,.04,'lamp')
    bench(-.3, .71)
    # Timetable and pole sit beside the shelter, outside the front circulation.
    box(.72, 1.08, .82, .31, .03, .63, 'ivory')
    for i in range(5): box(.77, 1.04, .95+i*.07, .2, .015, .013, 'teal', 0)
    cyl(1.52, -.96, .2, .045, 2.0, 'steel')
    box(1.28, -1.03, 1.83, .48, .12, .38, 'teal')
    text('BUS', 1.52, -1.1, 2.02, .18, 'white')
    box(-1.68, -1.64, .2, 3.36, .16, .07, 'gold')


def substation():
    # Four slabs leave a real opening: the stair treads descend below grade.
    for x,y,w,d in [(-1.9,-1.9,.9,3.8),(1,-1.9,.9,3.8),(-1,-1.9,2,.65),(-1,1.35,2,.55)]:
        box(x,y,-.36,w,d,.56,'paving')
    box(-1,-1.25,-.35,2,2.6,.05,'dark')
    for x in [-1.06,.96]: box(x,-1.25,-.36,.1,2.65,.56,'ivory')
    box(-1,1.27,-.36,2,.09,.56,'ivory')
    for i in range(9):
        z=.18-i*.055
        box(-.95,-1.25+i*.28,z-.11,1.9,.28,.11,'slate')
        box(-.92,-1.25+i*.28,z,1.84,.035,.025,'cream')
    for x in [-1.16,1.16]:
        for y in [-1.15,0,1.23]: beam((x,y,.2),(x,y,1.13),.032,'teal')
        beam((x,-1.25,1.13),(x,1.33,1.13),.045,'teal')
    for x in [-1.25,1.25]:
        box(x-.07,.72,.2,.14,.14,1.9,'teal')
    box(-1.42,.66,2.05,2.84,.3,.36,'teal')
    text('METRO',0,.63,2.23,.29,'lamp')
    text('METRO',0,.99,2.23,.29,'lamp',face='back')
    box(-1.27,.75,2.41,2.54,.65,.09,'copper')
    box(-.75,.78,2.03,1.5,.08,.045,'lamp')
    # Ticket machine sits on its own strip, clear of the stair and railing.
    box(-1.78,.38,.2,.42,.48,1.08,'teal')
    box(-1.71,.35,.8,.28,.025,.3,'glasslight')
    box(-1.69,.34,.59,.22,.025,.06,'gold')


def railstation():
    base(8,'paving')
    # The center hall has doors on both ends, rather than windows hidden by doors.
    box(-1.16,-3.01,.2,2.32,3.22,.22,'ivory')
    box(-1.1,-2.95,.42,2.2,3.1,3.18,'bricklight')
    box(-1.17,-3.02,3.44,2.34,3.24,.18,'cream')
    roof(-1.26,-3.11,3.6,2.52,3.42,.77,'slate')
    for z in [.8,2.25]:
        for y in [-2.25,-.65]:
            window(-1.1,y,z,side='left',lit=True)
            window(1.1,y,z,side='right')
    window(0,.15,2.25,w=.65,side='back',lit=True)
    before=set(bpy.context.scene.objects)
    door(0,.15,.2,w=1.05,h=1.7)
    for obj in set(bpy.context.scene.objects)-before:
        obj.location.x=-obj.location.x
        obj.location.y=.3-obj.location.y
        obj.rotation_euler.z+=math.pi
    for x in [-3.35,1.15]: building(x,-2.55,.2,2.2,2.5,2.45,'brick',floors=1)
    door(0,-2.95,.2,w=1.05,h=1.7)
    clock(0,-3.04,2.82,.3)
    box(-1.2,-3.17,1.99,2.4,.12,.28,'teal')
    text('RAILWAY',0,-3.25,2.13,.22,'cream')
    paving(-3.5,.3,7,3.2)
    box(-3.5,3.38,.21,7,.13,.055,'gold')
    # A shallow butterfly canopy drains into its center gutter.
    verts=[(-3.5,.8,2.8),(3.5,.8,2.8),(3.5,1.8,2.58),(-3.5,1.8,2.58),(-3.5,3,2.8),(3.5,3,2.8)]
    mesh('platform butterfly roof',verts,[(0,1,2,3),(3,2,5,4)],'copper')
    for x in [-3,-1,1,3]:
        beam((x,1.8,.2),(x,1.8,2.59),.045,'teal')
        beam((x,1.8,2.2),(x,.85,2.78),.035,'teal')
        beam((x,1.8,2.2),(x,2.95,2.78),.035,'teal')
    for y in [.8,3]: beam((-3.5,y,2.8),(3.5,y,2.8),.04,'cream')
    for x in [-2,2]:
        box(x-.4,1.76,2.51,.8,.08,.06,'lamp')
        bench(x,.85,math.pi)
    lamp(-3.45,-3.4);lamp(3.45,-3.4)
