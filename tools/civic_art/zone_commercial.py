"""Every commercial density, growth stage, footprint and architectural family."""
from zone_retail import retail
from zone_business import business
from zone_office_towers import tower

for density,sizes in [(1,[1]),(2,[1,2]),(3,[1,2,3])]:
    for level in range(1,5):
        for size in sizes:
            key=f'commercial-d{density}-l{level}-s{size}'
            count=5 if density==1 else 7 if density==2 else 3 if size==1 else 6
            for variant in range(count):
                def model(density=density,level=level,size=size,variant=variant):
                    if density==1:retail(level,variant)
                    elif density==2:business(size,level,variant)
                    else:tower(size,level,variant)
                globals()[key if variant==0 else f'{key}_v{variant}']=model
