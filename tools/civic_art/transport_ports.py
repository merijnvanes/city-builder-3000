"""Port modules: the pieces an airport or seaport zone fills with.

A port grows module by module (src/sim/port-layout.js), so each piece is its
own small model on a one- or two-tile lot. Runway and quay pieces tile edge to
edge, so they paint the full lot with no framed base; buildings keep the
collection's ivory kerb. One tile is four model units.
"""
from common import *


def slab(size, mat, z=-.12, h=.28):
    """A full-lot surface with no kerb, for pieces that continue into their neighbours."""
    s = size / 2
    box(-s, -s, z, size, size, h, mat, .02)


def edge_lamp(x, y, mat='lamp', h=.32):
    cyl(x, y, .16, .05, h, 'slate', 8)
    ball(x, y, .16 + h + .05, .075, mat, sub=1)


# ── Airport ─────────────────────────────────────────────────────

def runway_surface(along_x, threshold):
    slab(4, 'asphalt')
    # Edge lines run the length of the strip; lights stand just outside them.
    for side in [-1.72, 1.62]:
        if along_x: box(-2, side, .16, 4, .1, .02, 'white', 0)
        else: box(side, -2, .16, .1, 4, .02, 'white', 0)
    for s in [-1.5, -.5, .5, 1.5]:
        for side in [-1.88, 1.88]:
            if along_x: edge_lamp(s, side, 'white', .22)
            else: edge_lamp(side, s, 'white', .22)
    if threshold:
        # Threshold bars read the same from either end of the strip.
        for i in range(6):
            offset = -1.35 + i * .54
            if along_x: box(-1.3, offset - .12, .16, 2.6, .24, .02, 'white', 0)
            else: box(offset - .12, -1.3, .16, .24, 2.6, .02, 'white', 0)
    else:
        for s in [-1.6, -.2, 1.2]:
            if along_x: box(s, -.08, .16, .8, .16, .02, 'white', 0)
            else: box(-.08, s, .16, .16, .8, .02, 'white', 0)


def airport_runway_x(): runway_surface(True, False)
def airport_runway_y(): runway_surface(False, False)
def airport_threshold_x(): runway_surface(True, True)
def airport_threshold_y(): runway_surface(False, True)


def airport_apron():
    # One quiet taxi line; a field of aprons reads as paving, not as a grid.
    slab(4, 'asphalt')
    box(-2, -.07, .16, 4, .14, .02, 'gold', 0)
    edge_lamp(-1.7, 1.7, 'blue', .26)


def airport_terminal():
    base(8, 'paving')
    paving(-3.8, 1.2, 7.6, 2.6, 'asphalt')
    # Low glazed hall with a cantilevered concourse toward the apron.
    building(-3.3, -2.4, .2, 6.6, 3.2, 2.3, 'ivory', floors=1, pitched=False)
    for x in [-2.9, -1.5, -.1, 1.3]:
        box(x, 1.02, .55, 1.15, .05, 1.5, 'glasslight')
        box(x + .59, .98, .53, .055, .08, 1.54, 'cream')
    box(-3.6, .7, 2.5, 7.2, 1.0, .15, 'cream')
    for x in [-3.2, 3.2]: beam((x, 1.2, .2), (x, 1.2, 2.5), .045, 'silver')
    # Jet bridge out over the apron.
    box(1.0, 1.6, 1.9, .5, 1.6, .6, 'silver')
    box(2.3, 2.0, 1.6, .55, .9, .5, 'silver')
    beam((2.55, 2.5, .2), (2.55, 2.5, 1.6), .05, 'slate')
    door(-1.2, -2.4, .2, w=1.5, h=1.7)
    paving(-3.6, -3.9, 7.2, 1.4)
    text('TERMINAL', -1.2, -2.51, 2.05, .3, 'teal')
    lamp(-3.4, -3.5, 2.2); lamp(3.4, -3.5, 2.2)
    for x in [-3.3, 3.3]: edge_lamp(x, 3.5, 'blue', .26)


def airport_tower():
    base(4, 'paving')
    cyl(0, 0, .2, .62, 4.9, 'ivory', 10, r2=.48)
    cyl(0, 0, 5.1, 1.05, .18, 'cream', 10)
    cyl(0, 0, 5.28, .95, .85, 'glasslight', 10)
    for i in range(10):
        a = i * math.tau / 10
        beam((math.cos(a) * .95, math.sin(a) * .95, 5.28), (math.cos(a) * .95, math.sin(a) * .95, 6.13), .03, 'ivory')
    cyl(0, 0, 6.13, 1.1, .16, 'cream', 10)
    cyl(0, 0, 6.29, .035, .95, 'steel', 8)
    box(-.35, -.03, 6.9, .7, .06, .06, 'silver')
    ball(0, 0, 7.3, .07, 'lamp')
    door(0, -.62, .2, w=.7, h=1.3)


def airport_hangar():
    base(8, 'paving')
    paving(-3.8, -3.9, 7.6, 1.9, 'asphalt')
    box(-3.5, -2.0, .2, 7.0, 5.6, 2.9, 'steel')
    roof(-3.66, -2.16, 3.1, 7.32, 5.92, 1.1, 'slate')
    # The door wall faces the apron; a full-height opening with sliding leaves.
    box(-3.2, -2.05, .25, 6.4, .04, 2.5, 'dark')
    for x in [-3.22, -1.6, .02, 1.62]: box(x, -2.09, .25, 1.55, .05, 2.45, 'silver')
    for x in [-3.22, -1.6, .02, 1.62]: box(x + .07, -2.12, .3, 1.4, .02, .8, 'glasslight')
    box(-3.6, -2.1, 2.7, 7.2, .14, .22, 'cream')
    text('HANGAR', 0, -2.16, 2.95, .34, 'white')
    lamp(3.6, -3.5, 2.2)


def airport_cargo():
    base(4, 'paving')
    box(-1.6, -.6, .2, 3.2, 2.3, 1.7, 'steel')
    roof(-1.72, -.72, 1.9, 3.44, 2.54, .55, 'slate')
    box(-1.0, -.62, .25, 1.4, .04, 1.4, 'dark')
    box(-.98, -.66, 1.55, 1.36, .05, .1, 'silver')
    paving(-1.7, -1.9, 3.4, 1.3, 'asphalt')
    for i, mat in enumerate(['teal', 'gold', 'red']):
        box(-1.35 + i * .95, -1.7, .2, .7, .7, .5, mat, .03)
        box(-1.4 + i * .95, -1.75, .2, .8, .8, .06, 'wood', .01)
    lamp(1.6, 1.6, 1.8)


def airport_fuel():
    base(4, 'paving')
    # A bund wall around three white tanks.
    for x, y, w, d in [(-1.75, -1.75, 3.5, .18), (-1.75, 1.57, 3.5, .18), (-1.75, -1.75, .18, 3.5), (1.57, -1.75, .18, 3.5)]:
        box(x, y, .2, w, d, .35, 'ivory', .03)
    for x, y in [(-.8, -.6), (.8, -.6), (0, .8)]:
        cyl(x, y, .2, .62, 1.55, 'white', 20)
        cyl(x, y, 1.75, .64, .08, 'silver', 20)
        cyl(x, y, 1.83, .12, .18, 'steel', 8)
    beam((-.8, -.6, .5), (.8, -.6, .5), .045, 'silver')
    beam((0, -.6, .5), (0, .8, .5), .045, 'silver')
    edge_lamp(1.65, -1.65, 'red', .5)


# ── Seaport ─────────────────────────────────────────────────────

def bollard(x, y):
    cyl(x, y, .2, .13, .3, 'slate', 12)
    beam((x - .2, y, .44), (x + .2, y, .44), .065, 'slate')


def seaport_quay():
    slab(4, 'paving')
    for s in [-1.2, 0, 1.2]:
        for side in [-1.72, 1.72]:
            bollard(s, side); bollard(side, s)
    box(-1.9, -1.9, .16, 3.8, .05, .015, 'gold', 0)
    box(-1.9, 1.85, .16, 3.8, .05, .015, 'gold', 0)
    # A mobile harbour crane on a slewing base at the centre of the quay.
    cyl(0, 0, .2, .6, .35, 'steel', 14)
    box(-.45, -.45, .55, .9, .9, .75, 'teal')
    box(-.42, .3, 1.3, .84, .17, .4, 'glasslight')
    beam((0, 0, 1.3), (0, 1.55, 3.4), .085, 'gold')
    beam((-.32, 0, 1.3), (0, 1.55, 3.4), .04, 'gold')
    beam((.32, 0, 1.3), (0, 1.55, 3.4), .04, 'gold')
    beam((0, 1.55, 3.4), (0, 1.55, 1.9), .018, 'slate')
    box(-.12, 1.43, 1.65, .24, .24, .25, 'gold')
    lamp(-1.6, -1.6, 2.2)


def seaport_pier():
    # A timber deck on piles. The lot's zero is the water surface; the piles
    # continue below it.
    for x in [-1.75, 0, 1.75]:
        for y in [-1.75, 0, 1.75]:
            cyl(x, y, -1.2, .1, 1.55, 'wood', 8)
    box(-2, -2, .2, 4, 4, .18, 'wood', .02)
    for i in range(1, 12):
        box(-2, -2 + i / 3, .38, 4, .012, .006, 'soil', 0)
    for x in [-1.75, 1.75]:
        for y in [-1.75, 1.75]: beam((x, y, .38), (x, y, .62), .035, 'slate')
    for s in [-1.2, 1.2]:
        bollard(s, -1.75); bollard(s, 1.75)
    lamp(1.6, -1.3, 1.7)


def seaport_warehouse():
    base(8, 'paving')
    paving(-3.8, -3.9, 7.6, 1.8, 'asphalt')
    building(-3.3, -2.0, .2, 6.6, 5.4, 2.9, 'brick', floors=1)
    for x in [-2.6, -.6, 1.4]:
        box(x, -2.06, .24, 1.2, .09, 1.9, 'teal')
        for z in [.5, .85, 1.2, 1.55, 1.9]: box(x, -2.1, z, 1.2, .03, .025, 'steel')
    box(-3.4, -2.1, 2.1, 6.8, .3, .12, 'cream')
    text('FREIGHT', 0, -2.16, 2.35, .3, 'cream')
    lamp(-3.5, -3.5, 2.2); lamp(3.5, -3.5, 2.2)


def seaport_office():
    base(4, 'paving')
    building(-1.3, -1.1, .2, 2.6, 2.2, 2.6, 'ivory', floors=2)
    door(0, -1.1, .2, w=.8, h=1.4)
    beam((1.45, -1.55, .2), (1.45, -1.55, 3.3), .03, 'steel')
    box(1.45, -1.6, 2.85, .5, .02, .35, 'red')
    lamp(-1.6, 1.5, 1.8)


def seaport_tanks():
    base(4, 'paving')
    for x, y in [(-.85, -.75), (.85, .75)]:
        cyl(x, y, .2, .78, 1.5, 'silver', 24)
        cyl(x, y, 1.7, .8, .07, 'steel', 24)
        for i in range(8):
            a = i * math.tau / 8
            beam((x + math.cos(a) * .82, y + math.sin(a) * .82, 1.7), (x + math.cos(a) * .82, y + math.sin(a) * .82, 2.0), .018, 'steel')
        beam((x - .58, y - .58, 2.0), (x + .58, y + .58, 2.0), .018, 'steel')
    beam((-.85, -.75, .55), (.85, .75, .55), .05, 'steel')
    beam((-1.85, -1.85, .35), (-.85, -.75, .35), .05, 'steel')
    edge_lamp(1.65, -1.65, 'red', .5)


CARGO = ['teal', 'blue', 'gold', 'red', 'ivory']


def container(x, y, z, mat):
    box(x, y, z, 1.7, .78, .72, mat)
    for i in range(8): box(x + .1 + i * .2, y - .02, z + .06, .03, .025, .6, mat, .004)
    for yy in [y + .08, y + .66]: beam((x, yy, z + .74), (x + 1.7, yy, z + .74), .02, 'steel')
    for xx in [x + .06, x + 1.6]: box(xx, y - .03, z + .04, .045, .03, .64, 'silver')


def container_yard(palette):
    slab(4, 'paving')
    box(-1.9, -1.9, .16, 3.8, .05, .015, 'gold', 0)
    for row in range(2):
        for col in range(2):
            x = -1.85 + col * 1.95; y = -1.5 + row * 1.6
            container(x, y, .2, CARGO[(col + row + palette) % 5])
            if (col + row) % 2 == 0: container(x, y, .94, CARGO[(col + row + 2 + palette) % 5])
    lamp(1.7, -1.7, 2.0)


def seaport_containers(): container_yard(0)
def seaport_containers_v1(): container_yard(1)
def seaport_containers_v2(): container_yard(3)


def seaport_gantry():
    base(8, 'paving')
    paving(-3.8, -3.6, 7.6, 7.2, 'asphalt')
    for row in range(2):
        for col in range(3):
            x = -3.4 + col * 2.2; y = -2.9 + row * 1.5
            container(x, y, .2, CARGO[(col + row) % 5])
            if (col + row) % 2 == 0: container(x, y, .94, CARGO[(col + row + 2) % 5])
    # Rail-mounted gantry: portal legs on rails, bracing, hoist and spreader.
    for x in [-2.4, 2.4]:
        box(x - .1, -3.6, .2, .2, 7.2, .09, 'steel')
        for y in [-1.6, 2.4]:
            box(x - .24, y - .35, .3, .48, .7, .28, 'slate')
            beam((x, y, .58), (x, y, 5.6), .12, 'gold')
        beam((x, -1.6, 1.1), (x, 2.4, 5.4), .055, 'gold')
        beam((x, 2.4, 1.1), (x, -1.6, 5.4), .055, 'gold')
    for y in [-1.6, 2.4]:
        box(-2.9, y - .16, 5.6, 5.8, .32, .36, 'gold')
        for i in range(5): beam((-2.6 + i * 1.1, y, 5.94), (-2.1 + i * 1.1, y, 6.35), .035, 'cream')
        beam((-2.7, y, 6.35), (2.7, y, 6.35), .045, 'gold')
    box(-.35, -1.75, 6.0, .7, 4.5, .25, 'teal')
    for x in [-.3, .2]: beam((x, .4, 6.02), (x, .4, 2.3), .02, 'slate')
    box(-.85, -.1, 2.1, 1.7, .78, .16, 'gold')
    box(1.0, -1.85, 4.55, .85, .8, .8, 'teal'); box(1.06, -1.88, 4.85, .72, .03, .4, 'glasslight')
    lamp(-3.6, 3.4, 2.7); lamp(3.6, -3.4, 2.7)
