const requestedFamily=new URLSearchParams(location.search).get('family');
const family=['civic','power','water','parks','transport','rewards','deals','landmarks','residential','commercial','industrial'].includes(requestedFamily)?requestedFamily:'civic';
let catalog,state='day',rotation=0,detail=false,density=0,level=0;
const cards=[];
function update(){
  document.body.classList.toggle('detail',detail);
  document.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.state===state));
  document.querySelectorAll('[data-detail]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.detail===String(detail)));
  document.querySelector('#angle').textContent=`${rotation+1} / 4`;
  for(const {type,variant,stage,img,figure} of cards){
    const zone=catalog[type].zone;
    figure.hidden=!!zone && ((density && zone.density!==density)||(level && zone.level!==level));
    if(figure.hidden)continue;
    const spec=catalog[type],f=spec.frames[`${state}-${rotation}${variant?`-v${variant}`:''}`];if(!f)continue;
    const zoom=Math.min(detail?2.6:1,(stage.clientWidth-36)/(f.width/spec.scale),(stage.clientHeight-30)/(f.height/spec.scale));
    img.src=`./assets/civic/${f.file}`;
    img.style.width=`${f.width/spec.scale*zoom}px`;
    img.style.left=`${stage.clientWidth/2-f.anchor[0]/spec.scale*zoom}px`;
    img.style.top=`${(stage.clientHeight-f.height/spec.scale*zoom)/2}px`;
  }
}
try{
  const response=await fetch('./civic-catalog.json');if(!response.ok)throw new Error('Asset catalog could not be loaded.');catalog=await response.json();
  for(const other of ['civic','power','water','parks','transport','rewards','deals','landmarks','residential','commercial','industrial'].filter(value=>value!==family)){
    const link=document.createElement('a');link.href=`?family=${other}`;link.textContent=`View ${other} collection →`;link.className='family-link';document.querySelector('nav').prepend(link);
  }
  if(family==='power'){
    document.title='Power Collection · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 02';
    document.querySelector('h1').textContent='The power behind the city.';
    document.querySelector('header p').textContent='Eight distinct ways to power a city, from brick coal works to a futuristic fusion campus. Original miniature architecture and recognizable generating equipment.';
  }
  if(family==='water'){
    document.title='Water Collection · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 03';
    document.querySelector('h1').textContent='Water for a growing city.';
    document.querySelector('header p').textContent='Four purposeful water works: freshwater pumps, elevated storage, membrane filtration, and open treatment basins. Crafted in brick, concrete, and teal metalwork.';
  }
  if(['residential','commercial','industrial'].includes(family)){
    for(const [label,max] of [['Density',3],['Stage',4]]){
      const select=document.createElement('select');select.setAttribute('aria-label',label);select.className='picker';
      select.add(new Option(`All ${label.toLowerCase()} levels`,'0'));
      for(let i=1;i<=max;i++)select.add(new Option(`${label} ${i}`,String(i)));
      select.onchange=()=>{if(label==='Density')density=Number(select.value);else level=Number(select.value);update();};
      document.querySelector('nav').append(select);
    }
  }
  if(family==='industrial'){
    document.title='Industrial Architecture · City Builder 3000';
    document.querySelector('.eyebrow').textContent='CITY BUILDER 3000 · WORKING LANDSCAPES';
    document.querySelector('h1').textContent='Fields, workshops and works.';
    document.querySelector('header p').textContent='Planted fields, barnyards, rooflit warehouses and tank-and-stack factories. Every industrial density, growth stage and supported lot size has its own authored architecture.';
  }
  if(family==='commercial'){
    document.title='Commercial Architecture · City Builder 3000';
    document.querySelector('.eyebrow').textContent='CITY BUILDER 3000 · BUSINESS DISTRICTS';
    document.querySelector('h1').textContent='From corner shop to skyline.';
    document.querySelector('header p').textContent='Markets, diners, offices, hotels and signature towers. Every commercial density, growth stage and supported lot size has its own authored architecture.';
  }
  if(family==='residential'){
    document.title='Residential Architecture · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Neighborhood Collection';
    document.querySelector('h1').textContent='A place to call home.';
    document.querySelector('header p').textContent='Cottages, verandas, brownstones, courtyard apartments, balconies and towers. Every density, growth stage and supported lot size has its own authored architecture.';
  }
  if(family==='landmarks'){
    document.title='Landmarks · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 08';
    document.querySelector('h1').textContent='The places people remember.';
    document.querySelector('header p').textContent='A clock above the square, music beneath a copper dome, stone spires, a telescope open to the sky, and a hall shaped by waves. Five landmarks for a distinctive skyline.';
  }
  if(family==='deals'){
    document.title='Business Deals · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 07';
    document.querySelector('h1').textContent='Big sites. Bigger decisions.';
    document.querySelector('header p').textContent='A secure prison, a stepped casino, contained waste storage, a barracks campus and a glass-roofed shopping hall. Five business offers with distinct architectural identities.';
  }
  if(family==='rewards'){
    document.title='Rewards Collection · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 06';
    document.querySelector('h1').textContent='Places a city earns.';
    document.querySelector('header p').textContent='A mayor’s home, public monuments, places of learning and research, and destinations for sport and sailing. Eight rewards for a growing city.';
  }
  if(family==='transport'){
    document.title='Transport Collection · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 05';
    document.querySelector('h1').textContent='A city on the move.';
    document.querySelector('header p').textContent='Sheltered bus stops, subway stairs, a railway hall, and the pieces an airport or seaport zone fills with: runways, terminals, hangars, quays, piers and cargo yards. Purposeful routes for passengers and freight.';
  }
  if(family==='parks'){
    document.title='Parks Collection · City Builder 3000';
    document.querySelector('.eyebrow').textContent='City Builder 3000 · Asset Collection 04';
    document.querySelector('h1').textContent='Room to breathe and explore.';
    document.querySelector('header p').textContent='Three neighborhood gardens, a landscaped park with a bandstand, and a zoo full of distinctive habitats. Places to rest, gather, and discover.';
  }
  for(const [type,spec] of Object.entries(catalog).filter(([,spec])=>spec.family===family))
  for(const [variant,layout] of (spec.variants || [{label:spec.label,description:spec.description}]).entries()){
    const label=spec.variants?`${spec.label} · ${layout.label}`:layout.label,description=layout.description;
    const figure=document.createElement('figure');figure.className='card';
    const stage=document.createElement('div');stage.className='stage';
    const img=document.createElement('img');img.alt=label;img.decoding='async';stage.append(img);
    const caption=document.createElement('figcaption');caption.innerHTML=`<span class="index">${String(cards.length+1).padStart(2,'0')} / ${family.toUpperCase()}</span><h2>${label}</h2><p class="description">${description}</p>`;
    figure.append(stage,caption);document.querySelector('#collection').append(figure);cards.push({type,variant,stage,img,figure});
  }
  document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>{state=b.dataset.state;update()});
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{detail=b.dataset.detail==='true';update()});
  document.querySelector('#rotate').onclick=()=>{rotation=(rotation+1)%4;update()};
  new ResizeObserver(update).observe(document.querySelector('#collection'));update();
}catch(error){document.querySelector('#error').textContent=error.message;}
