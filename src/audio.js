// Original small procedural score: electric-piano chords, bass and brushed
// percussion. No audio downloads and no sound until the player enables it.
export class CityAudio{
 constructor(){this.enabled=false;this.context=null;this.timer=null;this.step=0;this.next=0;}
 async toggle(){
  if(!this.context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.065;this.master.connect(this.context.destination);}
  this.enabled=!this.enabled;
  if(this.enabled){await this.context.resume();this.next=this.context.currentTime+.08;this.timer=setInterval(()=>this.schedule(),120);this.schedule();}
  else{clearInterval(this.timer);this.timer=null;await this.context.suspend();}
  return this.enabled;
 }
 note(midi,time,duration,gain=.3,type='sine'){
  if(!this.context)return;const oscillator=this.context.createOscillator(),envelope=this.context.createGain();oscillator.type=type;oscillator.frequency.value=440*Math.pow(2,(midi-69)/12);envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(gain,time+.015);envelope.gain.exponentialRampToValueAtTime(.001,time+duration);oscillator.connect(envelope);envelope.connect(this.master);oscillator.start(time);oscillator.stop(time+duration+.03);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
 }
 schedule(){if(!this.enabled||document.hidden)return;const ctx=this.context;if(this.next<ctx.currentTime)this.next=ctx.currentTime+.05;while(this.next<ctx.currentTime+.35){const chords=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[55,59,62,65]],chord=chords[Math.floor(this.step/16)%4],beat=this.step%16;
   if(beat%4===0)for(let i=0;i<4;i++)this.note(chord[i],this.next+i*.014,1.6,.16);
   if(beat%4===0||beat===6||beat===14)this.note(chord[0]-12+(beat===14?7:0),this.next,.55,.35,'triangle');
   if([3,7,10,13].includes(beat))this.note(chord[(beat+Math.floor(this.step/16))%4]+12,this.next,.45,.12);
   this.next+=60/88/4;this.step++;
  }}
 effect(kind='click'){if(!this.enabled)return;const t=this.context.currentTime;this.note(kind==='build'?48:kind==='error'?38:72,t,.09,.2,'triangle');if(kind==='build')this.note(55,t+.055,.16,.12);}
}
