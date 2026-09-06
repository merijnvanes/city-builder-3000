// Original procedural architecture. Geometry is projected by the renderer;
// each lot has a stable architectural family, materials, and rooftop detail.
export const random=(x,y,n=0)=>{const v=Math.sin(x*127.1+y*311.7+n*73.3)*43758.5453;return v-Math.floor(v);};
const choose=(list,n)=>list[Math.floor(n*list.length)%list.length];
export function heightOf(t){
 if(['residential','commercial','industrial'].includes(t.type)&&!t.level)return 0;
 const level=t.level||1;
 if(t.type==='residential')return level===1?23:level===2?36:level===3?58:82;
 if(t.type==='commercial')return level===1?15:level===2?40:level===3?75:110;
 return {industrial:32,power:56,water:47,school:25,hospital:44,police:24,fire:21,bus:9,landfill:8,park:18}[t.type]||0;
}

export function drawArchitecture(r,t){
 const {x,y,type,level}=t,n=t.variant??random(x,y),family=Math.floor(n*7),z=0;
 const flat=(a,b,w,d,h,c)=>r.flat(x+a,y+b,w,d,h,c);
 const box=(a,b,w,d,h,c,base=0)=>r.box(x+a,y+b,w,d,h,c,base);
 const windows=(a,b,w,d,h,seed,glass=false,base=0)=>r.windows(x+a,y+b,w,d,h,seed,glass,base);
 const tree=(a,b,k=0)=>r.tree(x+a,y+b,k);
 const roof=(a,b,w,d,base,h,c)=>r.roof(x+a,y+b,w,d,base,h,c);
 const zones=['residential','commercial','industrial'];
 if(zones.includes(type)&&!level){
  const c={residential:'#569238',commercial:'#346d9a',industrial:'#b79c38'}[type];
  flat(.035,.035,.93,.93,.25,c);
  for(let a=.1;a<.9;a+=.2)r.line(r.project(x+a,y+.05,.3),r.project(x+a,y+.95,.3),'#d1dcba66',.5);
  flat(.08,.08,.84,.025,.4,'#e0e0ae');flat(.08,.08,.025,.84,.4,'#e0e0ae');
  return;
 }
 if(type==='residential'){
  const wall=choose(['#d0b690','#c2b69c','#d8c6a6','#a69583','#c1baa5','#d8c4b0'],n);
  const brick=choose(['#aa8066','#987864','#b29b80','#ad9984','#998981'],n);
  flat(.03,.03,.94,.94,.2,'#6f8845');
  if(level===1){
   flat(.56,.58,.31,.42,.3,'#a6a292');
   const w=family%2?.54:.64,d=family%3?.49:.59;
   box(.16,.18,w,d,12,wall);roof(.13,.15,w+.06,d+.06,12,8,choose(['#8c543c','#555a56','#8b7961','#6e4b3c','#a0774e'],n));
   windows(.16,.18,w,d,13,x+y,false);
   box(.6,.52,.25,.3,9,'#b4aa91');roof(.58,.5,.29,.34,9,4,'#6d6b5a');
   box(.22,.25,.085,.09,9,'#94755a',13);
   flat(.18,.73,.12,.27,.3,'#b8b39c');
   box(.57,.85,.11,.17,3,choose(['#e8e3c9','#98714a','#698591'],n));
   r.fence(x+.07,y+.93,.82,0,'#ada894');r.fence(x+.93,y+.08,0,.83,'#ada894');
   tree(.18,.82,1);if(family%2)tree(.85,.2,2);
  }else if(level===2){
   flat(.04,.05,.92,.88,.3,'#a6a38c');
   if(family%2){
    box(.09,.12,.33,.72,30,brick);box(.47,.12,.39,.72,30,wall);
    windows(.09,.12,.33,.72,30,x);windows(.47,.12,.39,.72,30,y);
    roof(.07,.1,.37,.76,30,5,'#646657');roof(.45,.1,.43,.76,30,5,'#777b67');
   }else{
    box(.1,.1,.75,.37,28,brick);box(.1,.47,.33,.4,28,brick);
    windows(.1,.1,.75,.37,28,x);windows(.1,.47,.33,.4,28,y);
    flat(.11,.11,.72,.34,28.1,'#7b7e6c');flat(.11,.47,.3,.38,28.1,'#7b7e6c');
    tree(.7,.68,1);box(.55,.81,.22,.045,3,'#886344');
   }
   for(let h=9;h<27;h+=8)for(const f of r.faces(x+.09,y+.09,.79,.79,0,h))r.line(f.points[0],f.points[1],'#c2baa1',1.1);
  }else{
   const h=heightOf(t)-8+(family%3)*3;
   flat(.04,.04,.92,.92,.3,'#aaa78d');box(.09,.1,.79,.77,7,brick);
   box(.18,.18,.61,.6,h,wall,7);windows(.18,.18,.61,.6,h,x+y,false,7);
   for(let a=14;a<h+7;a+=8)for(const f of r.faces(x+.15,y+.15,.67,.66,0,a))r.line(f.points[0],f.points[1],'#d1c4a0',1.5);
   // Recessed roof and mechanical penthouse.
   flat(.19,.19,.59,.58,h+7.1,'#858978');box(.34,.3,.23,.22,5,'#a39e88',h+7);
   if(family%2)box(.58,.28,.09,.1,4,'#697b70',h+7);
   tree(.12,.87,0);tree(.86,.13,2);
  }
  return;
 }
 if(type==='commercial'){
  flat(.025,.025,.95,.95,.2,'#b1aea0');
  const stone=choose(['#b4b3a0','#c4b9a1','#b4a88d','#d0c9b4','#9eaba5'],n);
  if(level===1){
   flat(.05,.55,.9,.4,.3,'#727b72');
   for(let a=.12;a<.9;a+=.17)flat(a,.59,.018,.28,.5,'#ccc9ae');
   box(.08,.1,.82,.43,12,stone);windows(.08,.1,.82,.43,13,x+y,true);
   flat(.07,.09,.84,.45,12.1,'#8b8e7d');
   box(.09,.5,.8,.07,3,choose(['#a24d3e','#3e7377','#b28e48','#617844'],n),8);
   box(.3,.22,.19,.15,3,'#bec0ad',12);
   for(let a=0;a<3;a++)box(.14+a*.25,.72,.095,.17,3,choose(['#e3dbb9','#698c9a','#a66049','#c9c3a1'],(n+a*.23)%1));
  }else if(level===2||family===0){
   const h=level===2?32:60;
   box(.08,.08,.81,.81,h,stone);windows(.08,.08,.81,.81,h,x+y,false);
   for(let a=8;a<h;a+=8)for(const f of r.faces(x+.065,y+.065,.84,.84,0,a))r.line(f.points[0],f.points[1],'#c9c5ad',1.1);
   box(.06,.06,.85,.85,3,'#d3cbb2',h);flat(.13,.13,.71,.71,h+3.1,'#777e70');
   box(.3,.27,.18,.2,4,'#b2b3a0',h+3);
   if(family===0){box(.35,.35,.28,.28,8,'#c3b9a0',h+3);roof(.33,.33,.32,.32,h+11,7,'#638070');}
  }else{
   const h=heightOf(t)-12,familyGlass=family%3;
   const glass=choose(['#527a87','#648d96','#56746e','#738d87','#648491','#879b9a'],n);
   box(.07,.07,.86,.86,8,stone);windows(.07,.07,.86,.86,9,x+y,true);
   const w=familyGlass===1?.53:.65,d=familyGlass===2?.52:.65;
   box(.17,.17,w,d,h,glass,8);
   windows(.17,.17,w,d,h,x+y,true,8);
   for(let a=13;a<h+8;a+=6)for(const f of r.faces(x+.167,y+.167,w+.006,d+.006,0,a))r.line(f.points[0],f.points[1],familyGlass===0?'#aab5a6':'#9aa89c',.6);
   for(let a=.22;a<.17+w;a+=.16){r.line(r.project(x+a,y+.17+d,8),r.project(x+a,y+.17+d,h+8),'#b5b8a8',.65);}
   if(familyGlass===1){box(.22,.22,w-.1,d-.1,10,glass,h+8);box(.29,.3,.16,.16,8,stone,h+18);r.line(r.project(x+.37,y+.38,h+26),r.project(x+.37,y+.38,h+42),'#c6c8b5',1);}
   else if(familyGlass===2){box(.2,.2,w-.06,d-.06,4,'#c4c8b5',h+8);roof(.2,.2,w-.06,d-.06,h+12,12,'#607d76');}
   else {flat(.19,.19,w-.04,d-.04,h+8.1,'#6c7f75');box(.3,.3,.23,.2,6,'#b0b4a3',h+8);}
   tree(.88,.12,2);box(.15,.86,.32,.035,3,'#8f7653');
  }
  return;
 }
 if(type==='industrial'){
  flat(.02,.02,.96,.96,.2,'#9e9980');flat(.07,.65,.85,.27,.4,'#818371');
  const brick=choose(['#9f7558','#ae9270','#b0a28a','#8e8f80','#aa8d6d'],n);
  box(.08,.1,.77,.55,15+(level||1)*2,brick);windows(.08,.1,.77,.55,15,x+y);
  for(let a=0;a<3;a++)roof(.08+a*.255,.1,.255,.55,15+(level||1)*2,5,'#8d9685');
  if(family%2===0){
   for(let a=0;a<2;a++)r.cylinder(x+.22+a*.38,y+.34,.055,28+level*4,'#ad9577',14);
   for(let a=0;a<2;a++)r.cylinder(x+.66+a*.15,y+.79,.065,8,'#b4b6a0');
  }else{
   box(.16,.71,.22,.13,5,'#9c6542');box(.44,.71,.23,.13,5,'#60797a');
   box(.62,.15,.12,.18,4,'#777e6b',19);
  }
  return;
 }
 if(type==='park'){
  flat(.03,.03,.94,.94,.2,'#557c38');flat(.44,.02,.12,.96,.3,'#bfb798');flat(.02,.44,.96,.12,.3,'#bfb798');
  if(family%3===0){r.cylinder(x+.5,y+.5,.16,2,'#aaa88a');r.cylinder(x+.5,y+.5,.125,1,'#60999e',2);r.cylinder(x+.5,y+.5,.035,6,'#c2c9b3',2);}
  tree(.2,.2,1);tree(.8,.75,0);tree(.2,.78,2);box(.68,.22,.21,.045,3,'#90704d');return;
 }
 if(type==='power'){
  flat(.02,.02,.96,.96,.3,'#969781');box(.1,.39,.68,.49,18,'#988878');windows(.1,.39,.68,.49,18,x+y);
  for(let a=0;a<2;a++){r.cylinder(x+.25+a*.38,y+.25,.08,49,'#c4bda4');r.cylinder(x+.25+a*.38,y+.25,.081,5,'#a4624c',34);}
  box(.1,.42,.69,.44,2,'#787f6d',18);r.fence(x+.07,y+.93,.84,0,'#8b8c77');return;
 }
 if(type==='water'){
  flat(.06,.06,.88,.88,.2,'#859678');
  for(const a of [.26,.68])for(const b of [.26,.68])box(a,b,.045,.045,29,'#899b8d');
  r.cylinder(x+.49,y+.49,.28,14,'#a5b9b0',29);r.cylinder(x+.49,y+.49,.24,3,'#d1d2b6',43);
  r.line(r.project(x+.77,y+.45),r.project(x+.77,y+.45,43),'#a4b3a1',1);return;
 }
 if(type==='school'){
  flat(.025,.025,.95,.95,.2,'#a6ac8c');box(.1,.14,.78,.43,17,'#ae785b');roof(.08,.12,.82,.47,17,7,'#6c7666');windows(.1,.14,.78,.43,17,x+y);
  box(.41,.11,.18,.2,23,'#bca986');roof(.39,.09,.22,.24,23,5,'#737c6e');
  flat(.12,.68,.7,.23,.3,'#87976f');flat(.19,.71,.55,.17,.5,'#a0ad83');return;
 }
 if(type==='hospital'){
  flat(.02,.02,.96,.96,.2,'#aaad99');box(.09,.12,.79,.68,12,'#d0d1bc');box(.25,.17,.46,.48,34,'#c8cec0');windows(.25,.17,.46,.48,34,x+y,true);
  flat(.29,.21,.38,.4,34.1,'#768b79');flat(.42,.25,.1,.3,34.3,'#e4ded0');flat(.33,.35,.28,.1,34.3,'#e4ded0');
  box(.62,.82,.1,.17,3,'#e3dfca');return;
 }
 if(type==='police'||type==='fire'){
  flat(.03,.03,.94,.94,.2,'#a6ac97');box(.1,.14,.78,.64,19,type==='fire'?'#a97456':'#a7b2a6');
  windows(.1,.14,.78,.64,19,x+y,true);flat(.08,.12,.82,.68,19.1,type==='fire'?'#926146':'#557580');
  box(.34,.23,.25,.24,5,'#c5c6ac',19);box(.17,.83,.13,.16,3,type==='fire'?'#c14432':'#d6decd');return;
 }
 if(type==='landfill'){
  flat(.04,.04,.92,.92,.2,'#847957');for(let i=0;i<8;i++)box(.1+(i%3)*.25,.12+Math.floor(i/3)*.25,.22,.21,3+random(x,y,i)*6,choose(['#9a926d','#b7a780','#706e51','#a0a187'],random(x,y,i)));r.fence(x+.03,y+.94,.9,0,'#9b9a82');return;
 }
 if(type==='bus'){
  flat(.06,.06,.88,.88,.2,'#aeb5a0');box(.15,.2,.68,.45,7,'#7b9891');flat(.12,.17,.74,.51,7.1,'#5b7971');box(.25,.28,.4,.075,3,'#896d4c');r.line(r.project(x+.88,y+.76),r.project(x+.88,y+.76,10),'#bcc5af',1);return;
 }
}
