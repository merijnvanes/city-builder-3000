import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/?play`);
  await page.waitForFunction(()=>window.civic);
  const views=await page.evaluate(()=>{
    civic.agent.newCity({starter:false,layout:'plains',hills:0,seed:12});
    const r=civic.renderer, out=[], draw=r.ctx.fillText;
    try {
      for(let rotation=0;rotation<4;rotation++) {
        r.rotation=rotation;r.focusOn(32,32,.5);
        const labels=[];
        r.ctx.fillText=function(label,x,y,...rest){labels.push({label,x,y});return draw.call(this,label,x,y,...rest);};
        r.render(civic.city,1000);
        out.push(labels.filter(p=>/^[NESW]$/.test(p.label)));
      }
    } finally { r.ctx.fillText=draw; }
    return out;
  });
  for(const [rotation,labels] of views.entries()) {
    assert.equal(labels.length,4);
    assert.equal(labels.toSorted((a,b)=>a.y-b.y)[0].label,['N','W','S','E'][rotation]);
    assert.equal(labels.toSorted((a,b)=>b.x-a.x)[0].label,['E','N','W','S'][rotation]);
  }
  console.log('Canvas compass labels stay at the world corners in all four views.');
} finally { await browser.close(); }
