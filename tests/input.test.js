import test from 'node:test';
import assert from 'node:assert/strict';
import {attachInput} from '../src/input.js';
test('terrain previews reuse unchanged selections and invalidate when the city changes',()=>{
 const before=globalThis.window;globalThis.window=new EventTarget();
 try{
  const canvas=new EventTarget();canvas.getBoundingClientRect=()=>({left:0,top:0});
  const city={revision:1,money:1000};let planned=0;
  const renderer={pick:()=>({x:4,y:5})},actions={getCity:()=>city,getTool:()=> 'lower',getDensity:()=>1,onPreview:()=>{}};
  attachInput(canvas,renderer,actions,()=>({id:++planned}));
  for(let i=0;i<10;i++)canvas.dispatchEvent(Object.assign(new Event('pointermove'),{clientX:i,clientY:i,pointerId:1}));
  assert.equal(planned,1);
  city.revision++;canvas.dispatchEvent(Object.assign(new Event('pointermove'),{clientX:1,clientY:1,pointerId:1}));assert.equal(planned,2);
  city.money--;canvas.dispatchEvent(Object.assign(new Event('pointermove'),{clientX:2,clientY:1,pointerId:1}));assert.equal(planned,3);
 }finally{globalThis.window=before;}
});
