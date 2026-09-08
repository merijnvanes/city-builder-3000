"""All farms, workshops and industrial yards across supported growth states."""
from zone_farms import farm
from zone_factories import workshop,factory

for density,sizes in [(1,[1,3]),(2,[1,2]),(3,[1,2,3])]:
    for level in range(1,5):
        for size in sizes:
            key=f'industrial-d{density}-l{level}-s{size}'
            count=(4 if size==3 else 5) if density==1 else 7 if density==2 else 5
            for variant in range(count):
                def model(density=density,level=level,size=size,variant=variant):
                    if density==1:
                        if size==3:farm(level,variant)
                        else:workshop(level,variant)
                    else:factory(size,level,variant,density)
                globals()[key if variant==0 else f'{key}_v{variant}']=model
