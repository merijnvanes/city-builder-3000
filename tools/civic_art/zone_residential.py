"""Entry points for every supported residential density, stage, lot and family."""
from zone_homes import home
from zone_apartments import apartments
from zone_towers import tower

for density,sizes,count in [(1,[1],4),(2,[1,2],3),(3,[1,2,3],5)]:
    for level in range(1,5):
        for size in sizes:
            key=f'residential-d{density}-l{level}-s{size}'
            for variant in range(count):
                def model(density=density,level=level,size=size,variant=variant):
                    if density==1:home(level,variant)
                    elif density==2:apartments(size,level,variant)
                    else:tower(size,level,variant)
                globals()[key if variant==0 else f'{key}_v{variant}']=model
